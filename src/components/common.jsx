// Small shared UI pieces: spinner, friendly error box.

export function Spinner({ label = 'Working…' }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner-ring" />
      <span>{label}</span>
    </div>
  )
}

// Maps backend error codes to friendly, actionable copy.
const FRIENDLY = {
  invalid_key: 'A required API key is missing or invalid. Check your .env file and restart the server.',
  quota_exceeded: 'API quota/rate limit reached. Wait a bit or use a different key.',
  empty_results: 'No results to work with. Try a broader or different input.',
  parse_error: 'The AI response could not be read. Try running the stage again.',
  network_error: 'Could not reach the upstream API. Check your connection.',
  bad_request: 'Something was missing from the request.',
}

export function ErrorBox({ error }) {
  if (!error) return null
  const friendly = FRIENDLY[error.code]
  return (
    <div className="errorbox" role="alert">
      <strong>⚠ {friendly || 'Something went wrong.'}</strong>
      {error.message && <p className="errordetail">{error.message}</p>}
    </div>
  )
}
