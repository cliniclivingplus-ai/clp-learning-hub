export default function Loading() {
  return (
    <div className="p-5 sm:p-8 max-w-3xl">
      <div className="skeleton h-6 w-24 rounded-lg mb-6" />
      <div className="skeleton h-40 rounded-2xl mb-6" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
      </div>
    </div>
  );
}
