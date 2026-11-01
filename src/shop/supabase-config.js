// 배포 사이트가 쓰는 Supabase 프로젝트 (day4 게임과 같은 프로젝트 supabase-carmine-bridge).
// anon 키는 공개용이라 브라우저 코드에 들어가도 됩니다. 데이터 보호는 테이블의 RLS(supabase/schema.sql)가 맡아요.
// 환경변수 VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY 가 있으면 그 값이 먼저 쓰여요.
export const SUPABASE_URL = 'https://sfeltcffbggvuiggwhlx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZWx0Y2ZmYmdndnVpZ2d3aGx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyNTAwNDIsImV4cCI6MjEwODgyNjA0Mn0.wfBiOaE4znqmU2u0M9GmZ_J6yfiA1ZWrmGtybHptR8U';
