
CREATE TABLE public.cheques_devolvidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT current_date,
  valor_devolvido numeric NOT NULL DEFAULT 0,
  valor_rec_fornecedor numeric NOT NULL DEFAULT 0,
  valor_rec_empresa numeric NOT NULL DEFAULT 0,
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cheques_devolvidos TO authenticated;
GRANT ALL ON public.cheques_devolvidos TO service_role;

ALTER TABLE public.cheques_devolvidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_diretoria_select_cheques_devolvidos"
  ON public.cheques_devolvidos
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretoria')
  );

CREATE POLICY "admin_diretoria_insert_cheques_devolvidos"
  ON public.cheques_devolvidos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretoria')
  );

CREATE POLICY "admin_diretoria_update_cheques_devolvidos"
  ON public.cheques_devolvidos
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretoria')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretoria')
  );

CREATE POLICY "admin_diretoria_delete_cheques_devolvidos"
  ON public.cheques_devolvidos
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretoria')
  );
