/**
 * Generates an animated sample video directly in the browser via Canvas & MediaRecorder.
 * Useful for instant testing without requiring an external video file download.
 */
export async function createSampleVideoBlob(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 360;
  const ctx = canvas.getContext('2d')!;

  const fps = 20;
  const durationSec = 3;
  const totalFrames = fps * durationSec;
  const stream = canvas.captureStream(fps);

  let mimeType = 'video/webm';
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
    mimeType = 'video/webm;codecs=vp9';
  } else if (MediaRecorder.isTypeSupported('video/webm')) {
    mimeType = 'video/webm';
  } else if (MediaRecorder.isTypeSupported('video/mp4')) {
    mimeType = 'video/mp4';
  }

  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const recordingPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };
  });

  recorder.start();

  let frame = 0;
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      try {
        const t = frame / fps;
        const progress = frame / totalFrames;

        // Background
        const grad = ctx.createLinearGradient(0, 0, 480, 360);
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 480, 360);

        // Grid pattern
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        for (let x = 0; x < 480; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 360);
          ctx.stroke();
        }
        for (let y = 0; y < 360; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(480, y);
          ctx.stroke();
        }

        // Animated bouncing ball
        const bounce = Math.abs(Math.sin(t * Math.PI * 2.2));
        const ballY = 250 - bounce * 110;
        const ballX = 140 + Math.sin(t * Math.PI) * 110;

        // Shadow
        const shadowScale = Math.max(0.2, 1 - bounce * 0.7);
        ctx.beginPath();
        ctx.ellipse(ballX, 260, 32 * shadowScale, 9 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();

        // 3D Styled Ball
        const ballGrad = ctx.createRadialGradient(ballX - 10, ballY - 10, 4, ballX, ballY, 32);
        ballGrad.addColorStop(0, '#c084fc');
        ballGrad.addColorStop(0.4, '#818cf8');
        ballGrad.addColorStop(1, '#4338ca');
        ctx.beginPath();
        ctx.arc(ballX, ballY, 32, 0, Math.PI * 2);
        ctx.fillStyle = ballGrad;
        ctx.fill();

        // Titles & Counter
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GIF 動畫測試範例', 240, 52);

        ctx.font = '14px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`時間: ${t.toFixed(2)}s · 影格: #${frame + 1} / ${totalFrames}`, 240, 80);

        // Progress line
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(80, 290, 320, 8);
        ctx.fillStyle = '#818cf8';
        ctx.fillRect(80, 290, 320 * progress, 8);

        frame++;
        if (frame >= totalFrames) {
          clearInterval(interval);
          recorder.stop();
          recordingPromise.then(resolve).catch(reject);
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, 1000 / fps);
  });
}
