'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { prepareScanUpload } from '@/lib/scan-upload';
import { BusyBar } from '@/components/busy-bar';

interface AnalysisResult {
  summary: string[];
  flags: string[];
  missing: string[];
  goodClauses: string[];
}

export function LeaseAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { blob, filename } = await prepareScanUpload(file);
      const fd = new FormData();
      fd.append('file', blob, filename);
      const res = await fetch('/api/lease/analyze', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Analysis failed');
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload any lease PDF (your own or one from a tenant) to get a plain-English summary,
        red flags, and missing clauses.
      </p>

      <div className="space-y-2">
        <Label htmlFor="lease-upload">Lease PDF</Label>
        <Input
          id="lease-upload"
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
            setError(null);
          }}
        />
      </div>

      {file ? (
        <>
          <Button onClick={handleAnalyze} disabled={busy} className="w-full">
            <Sparkles size={14} />
            {busy ? 'Analyzing lease…' : 'Analyze with AI'}
          </Button>
          <BusyBar active={busy} />
        </>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-4">
          {result.summary.length > 0 && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Info size={14} className="text-blue-600" />
                Summary
              </h3>
              <ul className="space-y-1">
                {result.summary.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.goodClauses.length > 0 && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                <CheckCircle2 size={14} />
                Good clauses found
              </h3>
              <ul className="space-y-1">
                {result.goodClauses.map((g, i) => (
                  <li key={i} className="flex gap-2 text-sm text-green-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                    {g}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.flags.length > 0 && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                <AlertTriangle size={14} />
                Red flags / unusual clauses
              </h3>
              <ul className="space-y-1">
                {result.flags.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-amber-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.missing.length > 0 && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                Missing standard clauses
              </h3>
              <ul className="space-y-1">
                {result.missing.map((m, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                    {m}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="rounded-lg border bg-muted/30 p-2 text-xs text-muted-foreground">
            AI analysis is for informational purposes only. Consult a local attorney for legal
            advice.
          </p>
        </div>
      ) : null}
    </div>
  );
}
