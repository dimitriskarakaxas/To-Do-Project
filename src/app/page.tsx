import TodoApp from "./TodoApp";
import { listTodos } from "./actions";

export default async function Home() {
  const initialTodos = await listTodos();
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-20">
      <TodoApp initialTodos={initialTodos} />
    </main>
  );
}
