export default async function DeadlineDetail({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold">Deadline Details</h1>
      <p className="text-lg text-gray-600 mt-4">ID: {id}</p>
    </main>
  );
}
