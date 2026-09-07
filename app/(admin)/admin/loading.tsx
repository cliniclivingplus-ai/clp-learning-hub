export default function Loading() {
  return (
    <div className="p-5 sm:p-8 max-w-5xl">
      <div className="skeleton h-8 w-40 rounded-lg mb-2" />
      <div className="skeleton h-4 w-72 rounded-lg mb-8" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
      </div>
    </div>
  );
}
