import { useCallback, useEffect, useRef, useState } from 'react';
import { getRiwayat, kirimPesan } from '../services/chatbotService.js';
import './chatbot.css';

const SAPAAN = 'Halo! Aku asisten SIAPT. Tanyakan apa saja seputar layanan perpustakaan ya.';

const PERTANYAAN_CEPAT = [
  'Bagaimana cara meminjam koleksi?',
  'Kapan denda dikenakan?',
  'Bagaimana cara membayar denda?',
  'Bagaimana cara mengembalikan koleksi?',
];

const LABEL_SUMBER = {
  faq: 'Dari FAQ perpustakaan',
  gemini: 'Dijawab AI, bisa keliru',
};

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState({ aktif: true, panjangMaks: 300 });
  const [error, setError] = useState('');
  const [percobaan, setPercobaan] = useState(0);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const nextId = useRef(1);

  // Muat riwayat saat panel dibuka; jika gagal, dicoba lagi saat dibuka ulang atau lewat tombol
  useEffect(() => {
    if (!open || loaded) return undefined;
    let batal = false;

    (async () => {
      try {
        const data = await getRiwayat();
        if (batal) return;
        const pesan = [];
        for (const r of data.riwayat) {
          pesan.push({ id: `u-${r.id_pesan}`, peran: 'user', teks: r.pertanyaan });
          pesan.push({ id: `b-${r.id_pesan}`, peran: 'bot', teks: r.jawaban, sumber: r.sumber, whatsapp: r.whatsapp });
        }
        setMessages(pesan);
        setInfo({ aktif: data.aktif, panjangMaks: data.panjang_maks });
        setError('');
        setLoaded(true);
      } catch (err) {
        if (!batal) setError(err.message);
      }
    })();

    return () => {
      batal = true;
    };
  }, [open, loaded, percobaan]);

  // Tutup dengan tombol Escape
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Gulir otomatis ke pesan terbaru
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, sending, open, loaded]);

  const kirim = useCallback(
    async (teks) => {
      const pesan = teks.trim();
      if (!pesan || sending || pesan.length > info.panjangMaks) return;

      setMessages((prev) => [...prev, { id: `u-n${nextId.current++}`, peran: 'user', teks: pesan }]);
      setInput('');
      setSending(true);

      try {
        const data = await kirimPesan(pesan);
        setMessages((prev) => [
          ...prev,
          {
            id: `b-n${nextId.current++}`,
            peran: 'bot',
            teks: data.jawaban,
            sumber: data.sumber,
            whatsapp: data.whatsapp,
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { id: `b-n${nextId.current++}`, peran: 'bot', teks: err.message, galat: true },
        ]);
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
    },
    [sending, info.panjangMaks],
  );

  const terlaluPanjang = input.trim().length > info.panjangMaks;

  function bukaPanel() {
    setError('');
    setOpen(true);
  }

  function cobaLagi() {
    setError('');
    setPercobaan((n) => n + 1);
  }

  function handleSubmit(event) {
    event.preventDefault();
    kirim(input);
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          className="chatbot-fab"
          onClick={bukaPanel}
          aria-label="Buka chatbot AI"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>Tanya SIAPT</span>
        </button>
      )}

      {open && (
        <section className="chatbot-panel" role="dialog" aria-label="Chatbot AI SIAPT">
          <header className="chatbot-header">
            <div>
              <h2 className="chatbot-title">Chatbot AI SIAPT</h2>
              <p className="chatbot-subtitle">Tanya seputar layanan perpustakaan</p>
            </div>
            <button
              type="button"
              className="chatbot-close"
              onClick={() => setOpen(false)}
              aria-label="Tutup chatbot"
            >
              &times;
            </button>
          </header>

          <div className="chatbot-messages" ref={listRef} aria-live="polite">
            {!loaded && !error && <p className="chatbot-note">Memuat percakapan…</p>}
            {error && (
              <>
                <p className="chatbot-note chatbot-note-error">{error}</p>
                <button type="button" className="chatbot-chip" onClick={cobaLagi}>
                  Coba muat lagi
                </button>
              </>
            )}

            {(loaded || error) && messages.length === 0 && (
              <div className="chatbot-row bot">
                <div className="chatbot-bubble bot">
                  <span className="chatbot-text">{SAPAAN}</span>
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`chatbot-row ${m.peran}`}>
                <div className={`chatbot-bubble ${m.peran}${m.galat ? ' error' : ''}`}>
                  <span className="chatbot-text">{m.teks}</span>
                  {m.whatsapp && (
                    <a
                      className="chatbot-wa-btn"
                      href={m.whatsapp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Hubungi Pustakawan via WhatsApp ({m.whatsapp.tampil})
                    </a>
                  )}
                </div>
                {m.sumber && LABEL_SUMBER[m.sumber] && (
                  <span className="chatbot-source">{LABEL_SUMBER[m.sumber]}</span>
                )}
              </div>
            ))}

            {sending && (
              <div className="chatbot-row bot">
                <div className="chatbot-bubble bot chatbot-typing" aria-label="Chatbot sedang mengetik">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
          </div>

          {!info.aktif && (
            <p className="chatbot-banner">
              Layanan AI sedang nonaktif. Pertanyaanmu akan dialihkan ke Pustakawan lewat WhatsApp.
            </p>
          )}

          <div className="chatbot-chips">
            {PERTANYAAN_CEPAT.filter((q) => q.length <= info.panjangMaks).map((q) => (
              <button
                key={q}
                type="button"
                className="chatbot-chip"
                onClick={() => kirim(q)}
                disabled={sending}
              >
                {q}
              </button>
            ))}
          </div>

          {terlaluPanjang && (
            <p className="chatbot-note chatbot-note-error" role="alert">
              Pesan maksimal {info.panjangMaks} karakter. Persingkat dulu sebelum mengirim.
            </p>
          )}

          <form className="chatbot-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              className="chatbot-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={info.panjangMaks}
              placeholder="Ketik pertanyaanmu…"
              autoComplete="off"
              disabled={sending}
            />
            <button type="submit" className="chatbot-send" disabled={sending || !input.trim() || terlaluPanjang}>
              Kirim
            </button>
          </form>
          <p className="chatbot-counter">
            {input.length}/{info.panjangMaks}
          </p>
        </section>
      )}
    </>
  );
}