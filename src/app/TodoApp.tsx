"use client";

import {
  startTransition,
  useMemo,
  useOptimistic,
  useRef,
  useState,
} from "react";
import {
  addTodo,
  clearCompleted,
  deleteTodo,
  toggleTodo,
  updateTodoText,
} from "./actions";
import type { TodoRow } from "@/lib/supabase";

type Todo = {
  id: string;
  text: string;
  completed: boolean;
  created_at: string;
};

type Filter = "all" | "active" | "completed";

type OptimisticAction =
  | { type: "add"; todo: Todo }
  | { type: "toggle"; id: string; completed: boolean }
  | { type: "updateText"; id: string; text: string }
  | { type: "delete"; id: string }
  | { type: "clearCompleted" };

function reduce(state: Todo[], action: OptimisticAction): Todo[] {
  switch (action.type) {
    case "add":
      return [action.todo, ...state];
    case "toggle":
      return state.map((t) =>
        t.id === action.id ? { ...t, completed: action.completed } : t,
      );
    case "updateText":
      return state.map((t) =>
        t.id === action.id ? { ...t, text: action.text } : t,
      );
    case "delete":
      return state.filter((t) => t.id !== action.id);
    case "clearCompleted":
      return state.filter((t) => !t.completed);
  }
}

export default function TodoApp({ initialTodos }: { initialTodos: TodoRow[] }) {
  const [optimisticTodos, applyOptimistic] = useOptimistic<
    Todo[],
    OptimisticAction
  >(initialTodos, reduce);

  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    if (filter === "active") return optimisticTodos.filter((t) => !t.completed);
    if (filter === "completed")
      return optimisticTodos.filter((t) => t.completed);
    return optimisticTodos;
  }, [optimisticTodos, filter]);

  const remaining = optimisticTodos.filter((t) => !t.completed).length;
  const hasCompleted = optimisticTodos.some((t) => t.completed);

  function handleAdd() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    startTransition(async () => {
      applyOptimistic({
        type: "add",
        todo: {
          id: `optimistic-${crypto.randomUUID()}`,
          text,
          completed: false,
          created_at: new Date().toISOString(),
        },
      });
      await addTodo(text);
    });
  }

  function handleToggle(id: string, completed: boolean) {
    startTransition(async () => {
      applyOptimistic({ type: "toggle", id, completed });
      await toggleTodo(id, completed);
    });
  }

  function handleDelete(id: string) {
    if (editingId === id) setEditingId(null);
    startTransition(async () => {
      applyOptimistic({ type: "delete", id });
      await deleteTodo(id);
    });
  }

  function startEditing(todo: Todo) {
    setEditingId(todo.id);
    setEditingText(todo.text);
    requestAnimationFrame(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    });
  }

  function commitEdit() {
    if (!editingId) return;
    const id = editingId;
    const text = editingText.trim();
    setEditingId(null);
    if (!text) {
      handleDelete(id);
      return;
    }
    startTransition(async () => {
      applyOptimistic({ type: "updateText", id, text });
      await updateTodoText(id, text);
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function handleClearCompleted() {
    startTransition(async () => {
      applyOptimistic({ type: "clearCompleted" });
      await clearCompleted();
    });
  }

  return (
    <div className="w-full max-w-xl">
      <header className="mb-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight">To-Do</h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Stay focused. One task at a time.
        </p>
      </header>

      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
          className="flex items-center gap-2 border-b border-neutral-200 p-4 dark:border-neutral-800"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What needs to be done?"
            aria-label="New todo"
            className="flex-1 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-neutral-500 dark:border-neutral-700 dark:focus:border-neutral-400"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Add
          </button>
        </form>

        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {visible.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-neutral-500">
              {optimisticTodos.length === 0
                ? "Nothing here yet. Add your first task above."
                : `No ${filter} tasks.`}
            </li>
          ) : (
            visible.map((todo) => (
              <li
                key={todo.id}
                className="group flex items-center gap-3 px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => handleToggle(todo.id, !todo.completed)}
                  aria-label={`Mark "${todo.text}" as ${
                    todo.completed ? "active" : "completed"
                  }`}
                  className="size-5 shrink-0 cursor-pointer accent-neutral-900 dark:accent-white"
                />
                {editingId === todo.id ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      else if (e.key === "Escape") cancelEdit();
                    }}
                    className="flex-1 rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:focus:border-neutral-400"
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() => startEditing(todo)}
                    className={`flex-1 text-left text-sm transition ${
                      todo.completed
                        ? "text-neutral-400 line-through dark:text-neutral-500"
                        : "text-neutral-900 dark:text-neutral-100"
                    }`}
                    title="Double-click to edit"
                  >
                    {todo.text}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(todo.id)}
                  aria-label={`Delete "${todo.text}"`}
                  className="shrink-0 rounded-md p-1 text-neutral-400 opacity-0 transition hover:bg-neutral-100 hover:text-red-600 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-neutral-800"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="size-5"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.5H3.5a.75.75 0 0 0 0 1.5h.546l.564 10.16A2.75 2.75 0 0 0 7.357 18.5h5.286a2.75 2.75 0 0 0 2.747-2.59l.564-10.16h.546a.75.75 0 0 0 0-1.5H14v-.5A2.75 2.75 0 0 0 11.25 1h-2.5ZM12.5 4.25v-.5c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.5h5ZM8.5 8a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5A.75.75 0 0 1 8.5 8Zm3.75.75a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0v-5.5Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </li>
            ))
          )}
        </ul>

        {optimisticTodos.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-xs text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
            <span>
              {remaining} {remaining === 1 ? "task" : "tasks"} left
            </span>
            <div
              role="tablist"
              aria-label="Filter todos"
              className="flex items-center gap-1"
            >
              {(["all", "active", "completed"] as const).map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-2 py-1 capitalize transition ${
                    filter === f
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleClearCompleted}
              disabled={!hasCompleted}
              className="rounded-md px-2 py-1 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-neutral-800"
            >
              Clear completed
            </button>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-neutral-500">
        Tip: double-click a task to edit it.
      </p>
    </div>
  );
}
