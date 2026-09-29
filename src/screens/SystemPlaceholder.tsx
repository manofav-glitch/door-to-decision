import { Link, useParams } from 'react-router-dom';

export function SystemPlaceholder() {
  const { id } = useParams();
  return (
    <main>
      <h1 className="mb-2 text-2xl font-bold">System: {id}</h1>
      <p className="panel mb-4 p-4">Placeholder. Modules and cases arrive in Phase 1.</p>
      <Link to="/" className="flex min-h-11 items-center underline">
        ← All systems
      </Link>
    </main>
  );
}
