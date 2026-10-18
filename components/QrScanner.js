'use client';
import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
export default function QrScanner({ onCode, onClose }) {
  const video = useRef(null), canvas = useRef(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let stream, raf, stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
        const v = video.current; v.srcObject = stream; v.setAttribute('playsinline', 'true'); await v.play();
        const tick = () => {
          if (stopped) return;
          if (v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth) {
            const k = Math.min(1, 640 / v.videoWidth), c = canvas.current, ctx = c.getContext('2d', { willReadFrequently: true });
            c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
            ctx.drawImage(v, 0, 0, c.width, c.height);
            const img = ctx.getImageData(0, 0, c.width, c.height);
            const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
            if (r && r.data) { stopped = true; onCode(r.data); return; }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch { setErr('Cannot open the camera. Allow camera access in the browser, or type the code instead.'); }
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  return (
    <div className="modal" onClick={onClose}>
      <div className="card" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 12 }}>Scan guest QR code</h3>
        {err ? <p className="err">{err}</p> : <video ref={video} muted playsInline style={{ width: '100%', borderRadius: 12, background: '#000' }} />}
        <canvas ref={canvas} style={{ display: 'none' }} />
        <p className="note">Hold the guest's phone steady in front of the camera.</p>
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
