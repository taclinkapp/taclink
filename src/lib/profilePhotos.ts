import { supabase } from '@/integrations/supabase/client';

const PROFILE_BUCKET = 'profile-photos';

export type PublicProfileCard = {
  id: string;
  display_name: string | null;
  photo_url: string | null;
};

let pendingStudentSignupPhoto: File | null = null;

const uniqueIds = (ids: Array<string | null | undefined>) =>
  Array.from(new Set(ids.filter((id): id is string => !!id)));

export const rememberPendingStudentSignupPhoto = (file: File | null) => {
  pendingStudentSignupPhoto = file;
};

export const takePendingStudentSignupPhoto = () => {
  const file = pendingStudentSignupPhoto;
  pendingStudentSignupPhoto = null;
  return file;
};

export async function uploadAndSaveProfilePhoto(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(PROFILE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { data: pub } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(path);
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ photo_url: pub.publicUrl })
    .eq('id', userId);

  if (profileError) {
    await supabase.storage.from(PROFILE_BUCKET).remove([path]);
    throw profileError;
  }

  return pub.publicUrl;
}

export async function fetchPublicProfileCards(ids: Array<string | null | undefined>): Promise<PublicProfileCard[]> {
  const filtered = uniqueIds(ids);
  if (!filtered.length) return [];

  const { data, error } = await (supabase as any).rpc('get_public_profile_cards', { _ids: filtered });
  if (error) throw error;
  return (data ?? []) as PublicProfileCard[];
}

export async function fetchPublicProfileMap(ids: Array<string | null | undefined>): Promise<Map<string, PublicProfileCard>> {
  const cards = await fetchPublicProfileCards(ids);
  return new Map(cards.map((card) => [card.id, card]));
}

export async function fetchPublicProfileCard(id: string | null | undefined): Promise<PublicProfileCard | null> {
  if (!id) return null;
  const cards = await fetchPublicProfileCards([id]);
  return cards[0] ?? null;
}