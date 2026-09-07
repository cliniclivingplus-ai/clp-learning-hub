export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-14">
      <div className="skeleton h-8 w-64 rounded-lg mb-3" />
      <div className="skeleton h-4 w-96 rounded-lg mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}
      </div>
    </div>
  );
}
