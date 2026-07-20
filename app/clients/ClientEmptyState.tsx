"use client";

type Props = {
  searching: boolean;
  onAdd: () => void;
};

export default function ClientEmptyState({ searching, onAdd }: Props) {
  if (searching) {
    return (
      <div className="client-empty">
        <strong>No clients found</strong>
        <p>Try a different name, phone number, email, or address.</p>
      </div>
    );
  }

  return (
    <div className="client-empty">
      <strong>No clients yet</strong>
      <p>Add your first client, or create one from a new request.</p>
      <button type="button" className="btn primary" onClick={onAdd}>
        Add client
      </button>
    </div>
  );
}
