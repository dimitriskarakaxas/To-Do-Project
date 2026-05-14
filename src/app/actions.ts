"use server";

import { revalidatePath } from "next/cache";
import { supabase, type TodoRow } from "@/lib/supabase";

export async function listTodos(): Promise<TodoRow[]> {
  const { data, error } = await supabase
    .from("todos")
    .select("id, text, completed, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addTodo(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const { error } = await supabase.from("todos").insert({ text: trimmed });
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function toggleTodo(id: string, completed: boolean) {
  const { error } = await supabase
    .from("todos")
    .update({ completed })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function updateTodoText(id: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    await deleteTodo(id);
    return;
  }
  const { error } = await supabase
    .from("todos")
    .update({ text: trimmed })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function deleteTodo(id: string) {
  const { error } = await supabase.from("todos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function clearCompleted() {
  const { error } = await supabase
    .from("todos")
    .delete()
    .eq("completed", true);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
