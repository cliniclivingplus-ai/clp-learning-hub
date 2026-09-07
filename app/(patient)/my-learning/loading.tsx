export default function Loading() {
  return (
    <div className="p-5 sm:p-8 max-w-4xl">
      <div className="skeleton h-8 w-48 rounded-lg mb-2" />
      <div className="skeleton h-4 w-64 rounded-lg mb-8" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
    </div>
  );
}
