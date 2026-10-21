# Publicação desta versão (segurança do Supabase)

O banco e o front precisam ser atualizados **juntos**: a migração deixa o
bucket privado, e a versão antiga do site usa links públicos.

1. Suba este código para o GitHub e confirme que o build da Vercel passou
   (ainda sem promover para produção, se possível).
2. No Supabase "Gestão de Processos" → SQL Editor, rode
   `supabase/migrations/20261021_seguranca_acesso.sql`.
3. Promova/publique o deploy na Vercel.
4. Teste: login de admin, login de usuário comum (pedido → aprovar → abrir
   PDF), logout e novo login (deve pedir aprovação de novo).

Entre os passos 2 e 3 os PDFs não abrem na versão antiga. Faça em horário
de pouco uso.

## Configurações recomendadas no painel do Supabase

- Authentication → Sign In / Providers → Email: manter "Confirm email" ligado.
- Authentication → URL Configuration: Site URL = endereço da Vercel.
