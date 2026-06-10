// Supabase — anon key is intentionally public.
// Security relies on RLS policies configured in Supabase.
// NEVER replace with service_role key here.
export const SUPABASE_URL = 'https://pcyvwojezftzkjmssavg.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjeXZ3b2plemZ0emtqbXNzYXZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1Mzg2NTIsImV4cCI6MjA5NjExNDY1Mn0.eObJuG7e2Xni0B4wRV1K-yKk_eqIOLjlCSJO99BUdNk';

export const COLORS   = ['#185FA5','#0F6E56','#993C1D','#534AB7','#854F0B','#993556','#1D9E75','#D85A30','#D4537E','#639922'];
export const COLORS_L = ['#B5D4F4','#9FE1CB','#F5C4B3','#CECBF6','#FAC775','#F4C0D1','#5DCAA5','#F0997B','#ED93B1','#97C459'];

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_MB        = 5;

// Email del SuperAdmin — hardcodeado. Para cambiarlo requiere un nuevo deploy.
export const SUPERADMIN_EMAIL = 'javierbossio06@gmail.com';
