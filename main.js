class App {

  constructor() {
    this.state = 'idle';
  }

  view() {
    return m('section', { class: 'root' }, [
      m('header', [
        m('h1', [
          m('span', { class: 'gif' }, 'gif'),
          m('span', { class: 'cap' }, 'cap'),
        ])
      ]),
      m('section', { class: 'body' }, this.bodyView()),
      m('footer', 'footer'),
    ]);
  }

  bodyView() {
    switch (this.state) {
      case 'idle':
        return [
          this.recordedUrl ? m('img', { class: 'recording', src: this.recordedUrl }) : undefined,
          m('div', [
            m('button', { class: 'button primary', onclick: () => this.startRecording() }, [
              m('img', { src: 'https://icongr.am/octicons/play.svg?size=16&color=ffffff' }),
              'Start Recording'
            ]),
          ])
        ];
      case 'recording':
        return [
          m('div', [
            m('button', { class: 'button error', onclick: () => this.stopRecording() }, [
              m('img', { src: 'https://icongr.am/octicons/primitive-square.svg?size=16&color=ffffff' }),
              'Stop Recording'
            ]),
            typeof this.recordingStartTime === 'number' ? m('p', `Recording ${Math.floor((new Date().getTime() - this.recordingStartTime) / 1000)}s...`) : undefined,
          ]),
          m('canvas', { width: 640, height: 480 }),
          m('video', { autoplay: true, playsinline: true })
        ];
      case 'rendering':
        return [m('div', `Rendering ${Math.floor(this.renderingProgress * 100)}%...`)];
    }
  }

  onupdate(vnode) {
    if (this.state === 'recording' && this.recording === undefined) {
      const video = vnode.dom.getElementsByTagName('video')[0];
      const canvas = vnode.dom.getElementsByTagName('canvas')[0];
      this._startRecording(video, canvas);
    }
  }

  startRecording() {
    if (this.state !== 'idle') {
      return;
    }

    this.state = 'recording';
  }

  async _startRecording(video, canvas) {
    let captureStream;

    try {
      captureStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    } catch (err) {
      this.state = 'idle';
      m.redraw();
      return;
    }

    video.srcObject = captureStream;

    const ctx = canvas.getContext('2d');
    this.recordingStartTime = new Date().getTime();

    let timestamp = undefined;
    let first = true;

    const frameInterval = setInterval(async () => {
      try {
        let delay = 0;

        if (first) {
          const width = video.videoWidth;
          const height = video.videoHeight;

          this.recording.gif = new GIF({
            workers: navigator.hardwareConcurrency,
            quality: 10,
            width,
            height,
            workerScript: 'gif.worker.js',
          });

          canvas.width = `${width}`;
          canvas.height = `${height}`;
        }

        ctx.drawImage(video, 0, 0);
        const now = new Date().getTime();

        if (!first) {
          delay = now - timestamp;
          timestamp = now;
        }

        this.recording.gif.addFrame(ctx, { copy: true, delay: first ? undefined : delay });

        first = false;
      } catch (err) {
        if (err) {
          throw err;
        }
      }
    }, 100);

    const redrawInterval = setInterval(() => m.redraw(), 1000);
    m.redraw();

    const track = captureStream.getVideoTracks()[0];
    const endedListener = () => this.stopRecording();
    track.addEventListener('ended', endedListener);

    this.recording = {
      gif: undefined,
      stop: () => {
        clearInterval(frameInterval);
        clearInterval(redrawInterval);
        track.removeEventListener('ended', endedListener);
        track.stop();
      }
    };
  }

  stopRecording() {
    if (this.state !== 'recording' || !this.recording) {
      return;
    }

    this.state = 'rendering';
    this.recording.stop();
    this.renderingProgress = 0;

    this.recording.gif.on('progress', progress => {
      this.renderingProgress = progress;
      m.redraw();
    });

    this.recording.gif.once('finished', blob => {
      this.state = 'idle';
      this.recordedUrl = URL.createObjectURL(blob)

      m.redraw();
    });

    this.recording.gif.render();
    this.recording = undefined;
    this.recordingStartTime = undefined;
  }
}

function main() {
  m.mount(document.body, App);
}

main();