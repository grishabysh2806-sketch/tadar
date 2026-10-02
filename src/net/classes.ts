/*
 * Режим «Класс» на сервере: учитель создаёт класс и задания,
 * ученики вступают по коду, прогресс учеников виден учителю.
 */
import { getState, setState, type Assignment } from '../state/store';
import { weekStart } from '../lib/util';
import { api, check } from './client';

export interface ServerClass {
  id: string;
  code: string;
  name: string;
  school: string;
  teacher_id: string;
  created_at: string;
  teacher?: string;
  joined_at?: string;
}

export interface ServerAssignment {
  id: string;
  class_id: string;
  lesson_id: string;
  due: string;
  created_at: string;
}

export interface StudentRow {
  user_id: string;
  name: string;
  avatar: number;
  xp_total: number;
  streak: number;
  lessons_done: number;
  last_active: string;
  joined_at: string;
  week_xp: number;
  accuracy: number | null;
  done: string[];
}

export interface BoardRow {
  user_id: string;
  name: string;
  avatar: number;
  week_xp: number;
}

const CLASS_COLS = 'id, code, name, school, teacher_id, created_at';
const CODE_CHARS = 'АБВГДЕКМНПРСТ23456789';
const makeCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

/** Латинские буквы-двойники → кириллица (код часто набирают на английской раскладке). */
export function normalizeCode(raw: string) {
  const LAT: Record<string, string> = { A: 'А', B: 'В', E: 'Е', K: 'К', M: 'М', H: 'Н', O: 'О', P: 'Р', C: 'С', T: 'Т', X: 'Х' };
  return raw
    .trim()
    .toUpperCase()
    .replace(/[ABEKMHOPCTX]/g, (ch) => LAT[ch])
    .replace(/\s+/g, '');
}

export const toLocalAssignment = (a: ServerAssignment): Assignment => ({ id: a.id, lessonId: a.lesson_id, due: a.due, createdAt: Date.parse(a.created_at) || Date.now() });

/* ── Учитель ─────────────────────────────────────────────────────── */

export async function createClass(name: string, school: string): Promise<ServerClass> {
  const { sb } = await api();
  for (let i = 0; i < 6; i++) {
    const res = await sb.from('classes').insert({ code: makeCode(), name: name.trim().slice(0, 40), school: school.trim().slice(0, 80) }).select(CLASS_COLS).single();
    if (!res.error) {
      setState((d) => void (d.cls.teaching = (d.cls.teaching ?? 0) + 1));
      return res.data as ServerClass;
    }
    // совпал код — пробуем другой
    if ((res.error as { code?: string }).code !== '23505') check(res);
  }
  throw new Error('code');
}

export async function teacherClasses(): Promise<ServerClass[]> {
  const { sb, uid } = await api();
  const list = check(await sb.from('classes').select(CLASS_COLS).eq('teacher_id', uid).order('created_at')) as ServerClass[];
  if ((getState().cls.teaching ?? 0) !== list.length) setState((d) => void (d.cls.teaching = list.length));
  return list;
}

export async function deleteClass(id: string) {
  const { sb } = await api();
  check(await sb.from('classes').delete().eq('id', id));
}

export async function classAssignments(classId: string): Promise<ServerAssignment[]> {
  const { sb } = await api();
  return check(await sb.from('assignments').select('id, class_id, lesson_id, due, created_at').eq('class_id', classId).order('due').order('created_at')) as ServerAssignment[];
}

export async function addAssignment(classId: string, lessonId: string, due: string) {
  const { sb } = await api();
  check(await sb.from('assignments').insert({ class_id: classId, lesson_id: lessonId, due }));
}

export async function removeAssignment(id: string) {
  const { sb } = await api();
  check(await sb.from('assignments').delete().eq('id', id));
}

export async function classStudents(classId: string): Promise<StudentRow[]> {
  const { sb } = await api();
  return (check(await sb.rpc('class_dashboard', { p_class: classId, p_week: weekStart() })) as StudentRow[] | null) ?? [];
}

export async function removeStudent(classId: string, userId: string) {
  const { sb } = await api();
  check(await sb.from('class_members').delete().eq('class_id', classId).eq('user_id', userId));
}

/* ── Ученик ──────────────────────────────────────────────────────── */

/** Вступить по коду; null — такого класса нет. */
export async function joinClass(code: string): Promise<ServerClass | null> {
  const { sb } = await api();
  const cls = check(await sb.rpc('class_join', { p_code: normalizeCode(code) })) as ServerClass | null;
  if (cls) await refreshStudentClass(cls.id);
  return cls;
}

export async function myMemberships(): Promise<ServerClass[]> {
  const { sb, uid } = await api();
  const rows = check(
    // у классов две связи с профилями (учитель и ученики) — нужна связь через teacher_id
    await sb.from('class_members').select(`joined_at, classes(${CLASS_COLS}, profiles!classes_teacher_id_fkey(name))`).eq('user_id', uid).order('joined_at', { ascending: false }),
  ) as unknown as { joined_at: string; classes: (ServerClass & { profiles: { name: string } | null }) | null }[];
  return rows
    .filter((r) => r.classes)
    .map((r) => {
      const { profiles, ...c } = r.classes!;
      return { ...c, teacher: profiles?.name || '', joined_at: r.joined_at };
    });
}

/**
 * Класс ученика и его задания — в локальное состояние: так задания видны
 * на карте уроков и без сети. prefer — id класса, который показать.
 */
export async function refreshStudentClass(prefer?: string): Promise<ServerClass | null> {
  const list = await myMemberships();
  const cur = getState().cls.joined;
  if (!list.length) {
    if (cur) setState((d) => void (d.cls.joined = undefined));
    return null;
  }
  const pick = list.find((c) => c.id === prefer) ?? list.find((c) => c.id === cur?.id) ?? list[0];
  const tasks = (await classAssignments(pick.id)).map(toLocalAssignment);
  const next = {
    id: pick.id,
    code: pick.code,
    name: pick.name,
    teacher: pick.teacher || 'Учитель',
    joinedAt: Date.parse(pick.joined_at ?? '') || Date.now(),
    assignments: tasks,
  };
  if (JSON.stringify(cur) !== JSON.stringify(next)) setState((d) => void (d.cls.joined = next));
  return pick;
}

export async function leaveClass(classId: string) {
  const { sb, uid } = await api();
  check(await sb.from('class_members').delete().eq('class_id', classId).eq('user_id', uid));
  setState((d) => void (d.cls.joined = undefined));
}

export async function classBoard(classId: string): Promise<BoardRow[]> {
  const { sb } = await api();
  return (check(await sb.rpc('class_board', { p_class: classId, p_week: weekStart() })) as BoardRow[] | null) ?? [];
}
