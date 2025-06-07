'use client';

import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [html, setHtml] = useState('');
  const [clientHtml, setClientHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [spoofName, setSpoofName] = useState('');
  const [typingText, setTypingText] = useState('');
  const typingInterval = useRef<NodeJS.Timeout | null>(null);
  const dotInterval = useRef<NodeJS.Timeout | null>(null);

  const API_KEY = "SuperSecretKey123!@#abcdXYZ";

  useEffect(() => {
    if (!url.trim()) {
      setSpoofName('');
      let i = 0;
      const frames = ['.', '..', '...', '....', '.....', ''];
      if (dotInterval.current) clearInterval(dotInterval.current);
      dotInterval.current = setInterval(() => {
        setTypingText(frames[i % frames.length]);
        i++;
      }, 400);
      return () => {
        if (dotInterval.current) clearInterval(dotInterval.current);
      };
    } else {
      if (dotInterval.current) {
        clearInterval(dotInterval.current);
        dotInterval.current = null;
      }
    }
  }, [url]);

  function spoofSiteName(inputUrl: string) {
    try {
      const domain = new URL(inputUrl).hostname.replace('www.', '').split('.')[0].toLowerCase();

      if (domain.includes('facebook')) return domain.replace('facebook', 'Flasebook');
      if (domain.includes('instagram')) return domain.replace('instagram', 'Instascam');
      if (domain.includes('twitter')) return domain.replace('twitter', 'Twittr');
      if (domain.includes('google')) return domain.replace('google', 'Googel');
      if (domain.includes('linkedin')) return domain.replace('linkedin', 'LinkedOut');

      const mockPrefixes = ['Fake', 'Wannabe', 'Knockoff', 'Bootleg'];
      const mockSuffixes = ['.lol', 'Zone', 'Land', 'World', '-hub', '-central', 'Bay', 'verse'];

      const usePrefix = Math.random() < 0.5;
      const prefix = mockPrefixes[Math.floor(Math.random() * mockPrefixes.length)];
      const suffix = mockSuffixes[Math.floor(Math.random() * mockSuffixes.length)];

      let funnyCore = domain.replace(/[aeiou]/g, (v) => ({ a: '4', e: '3', i: '1', o: '0', u: 'ü' }[v] || v));
      funnyCore = funnyCore.slice(0, 8);

      return usePrefix ? prefix + funnyCore : funnyCore + suffix;
    } catch {
      return 'CloneyMcCloneface';
    }
  }

  const animateSpoofName = (name: string) => {
    let i = 0;
    if (typingInterval.current) clearInterval(typingInterval.current);
    typingInterval.current = setInterval(() => {
      setTypingText(name.slice(0, i + 1));
      i++;
      if (i >= name.length && typingInterval.current) {
        clearInterval(typingInterval.current);
      }
    }, 120);
  };

  const handleClone = async () => {
    if (!url.trim()) {
      setError('Please enter a valid URL.');
      return;
    }

    setLoading(true);
    setError('');
    setHtml('');
    setClientHtml('');
    setSpoofName('');
    setTypingText('');
    if (dotInterval.current) {
      clearInterval(dotInterval.current);
      dotInterval.current = null;
    }

    try {
      const response = await fetch('http://localhost:8000/clone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to clone website');
      }

      const data = await response.json();
      setHtml(data.html);

      const name = spoofSiteName(url);
      setSpoofName(name);
      animateSpoofName(name);

    } catch (err: any) {
      console.error('Error cloning website:', err);
      setError(err.message || 'Failed to clone website. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setClientHtml(html);
  }, [html]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 gap-6 bg-gradient-to-br from-blue-50 to-white text-gray-800">
      <div
        className="w-full max-w-4xl bg-white shadow-xl rounded-2xl p-8 border border-blue-100"
        role="main"
      >
        <h1
          className="text-3xl font-bold text-center text-blue-700 mb-1 tracking-wide"
          aria-live="polite"
        >
          🌐 {typingText || '.....'}
        </h1>
        <p className="text-center text-sm text-gray-500 mb-6 italic">
          {spoofName
            ? `Cloning "${url}" into a masterpiece...`
            : 'Our AI is thinking... What do you want to clone?'}
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="url"
            placeholder="Enter a public website URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="border border-gray-300 p-3 rounded-md flex-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Website URL input"
            disabled={loading}
          />
          <button
            onClick={handleClone}
            disabled={loading}
            className={`px-6 py-3 rounded-md text-white font-semibold transition ${
              loading
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            aria-busy={loading}
            aria-disabled={loading}
          >
            {loading ? (
              <span role="status" aria-live="polite" className="inline-flex items-center gap-2">
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Cloning...
              </span>
            ) : (
              'Clone'
            )}
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 text-red-600 text-sm font-medium"
          >
            {error}
          </p>
        )}

        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">🔎 Preview</h2>
          <div
            className="w-full border border-gray-300 rounded-md shadow-inner"
            aria-label="Website clone preview"
          >
            {clientHtml ? (
              <iframe
                srcDoc={clientHtml}
                className="w-full h-[600px] rounded-b-md"
                sandbox=""
                title="Cloned website preview"
              />
            ) : (
              <div className="p-6 text-center text-gray-500 italic">
                Enter a URL and click "Clone" to preview the page here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
