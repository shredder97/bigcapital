import { useTodoInbox } from './useTodoInbox';

export function TodoNavLabel() {
  const { badge, loading } = useTodoInbox(1);
  const count = !loading && badge > 0 ? ` ${badge}` : '';
  return <span>To-do{count}</span>;
}
