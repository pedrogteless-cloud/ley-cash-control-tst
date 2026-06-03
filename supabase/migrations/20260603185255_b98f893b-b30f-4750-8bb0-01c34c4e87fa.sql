
-- Seed de demonstração: limpa qualquer dado antigo e insere base realista
TRUNCATE TABLE public.notas_fiscais;
TRUNCATE TABLE public.caixa_movimentos;

-- 25 Notas Fiscais com mix realista de status
INSERT INTO public.notas_fiscais (fornecedor, nf, filial, valor, status_nf, entrega) VALUES
('Atualle Distribuidora',     '128453', 'MATRIZ', 18420.50, 'CHEGOU',   'CHEGOU 29/05'),
('Atualle Distribuidora',     '128501', 'MATRIZ', 12300.00, 'FATURADO', 'NÃO CHEGOU'),
('Nobeltex Têxtil',           '47821',  'MATRIZ', 32150.80, 'CHEGOU',   'CHEGOU 30/05'),
('Nobeltex Têxtil',           '47855',  'FILIAL', 8740.00,  'FATURADO', 'NÃO CHEGOU'),
('Confecções Pampa',          '9923',   'MATRIZ', 5420.30,  'CHEGOU',   'CHEGOU 28/05'),
('Confecções Pampa',          '9941',   'CARGA',  4180.00,  'FATURADO', 'EM TRÂNSITO'),
('Malharia Sul',              '15673',  'MATRIZ', 22890.00, 'CHEGOU',   'CHEGOU 31/05'),
('Malharia Sul',              '15702',  'MATRIZ', 9450.50,  'FATURADO', 'NÃO CHEGOU'),
('Têxtil Veneza',             '88412',  'FILIAL', 14200.00, 'CHEGOU',   'CHEGOU 27/05'),
('Têxtil Veneza',             '88489',  'FILIAL', 6780.00,  'FATURADO', 'NÃO CHEGOU'),
('Indústria Brasilândia',     '3341',   'MATRIZ', 41200.00, 'CHEGOU',   'CHEGOU 26/05'),
('Indústria Brasilândia',     '3398',   'MATRIZ', 19800.00, 'FATURADO', 'EM TRÂNSITO'),
('Aramis Confecções',         '7721',   'CARGA',  3290.40,  'CHEGOU',   'CHEGOU 30/05'),
('Aramis Confecções',         '7754',   'MATRIZ', 7820.00,  'FATURADO', 'NÃO CHEGOU'),
('Polenghi Tecidos',          '22119',  'MATRIZ', 16700.00, 'CHEGOU',   'CHEGOU 29/05'),
('Polenghi Tecidos',          '22177',  'FILIAL', 11240.00, 'FATURADO', 'NÃO CHEGOU'),
('Fios Cristal',              '5582',   'MATRIZ', 2890.00,  'CHEGOU',   'CHEGOU 31/05'),
('Fios Cristal',              '5601',   'MATRIZ', 3450.00,  'FATURADO', 'EM TRÂNSITO'),
('Etiquetas Real',            '1192',   'CARGA',  1820.50,  'CHEGOU',   'CHEGOU 28/05'),
('Etiquetas Real',            '1234',   'MATRIZ', 2100.00,  'FATURADO', 'NÃO CHEGOU'),
('Botões & Cia',              '4421',   'MATRIZ', 980.00,   'CHEGOU',   'CHEGOU 30/05'),
('Botões & Cia',              '4467',   'FILIAL', 1340.00,  'FATURADO', 'NÃO CHEGOU'),
('Embalagens Líder',          '6691',   'MATRIZ', 4720.00,  'CHEGOU',   'CHEGOU 27/05'),
('Transportes Águia',         '9001',   'CARGA',  2200.00,  'CHEGOU',   'CHEGOU 31/05'),
('Transportes Águia',         '9034',   'CARGA',  1850.00,  'FATURADO', 'EM TRÂNSITO');

-- 10 dias de movimento de caixa (saldo evolui dia a dia)
INSERT INTO public.caixa_movimentos (data, saldo_anterior, entrada, saida, saldo_total, destino) VALUES
('23/05', 145000.00, 28000.00, 12500.00, 160500.00, 'Atualle parcial'),
('24/05', 160500.00, 32000.00, 18420.00, 174080.00, 'Atualle 128453'),
('25/05', 174080.00, 15000.00, 5420.00,  183660.00, 'Confecções Pampa'),
('26/05', 183660.00, 41200.00, 41200.00, 183660.00, 'Indústria Brasilândia 3341'),
('27/05', 183660.00, 22000.00, 18920.00, 186740.00, 'Veneza + Embalagens'),
('28/05', 186740.00, 18500.00, 7240.00,  198000.00, 'Pampa + Etiquetas'),
('29/05', 198000.00, 24300.00, 35120.00, 187180.00, 'Atualle + Polenghi'),
('30/05', 187180.00, 31000.00, 36420.00, 181760.00, 'Nobeltex + Aramis + Botões'),
('31/05', 181760.00, 28000.00, 29610.00, 180150.00, 'Malharia + Fios + Transportes'),
('01/06', 180150.00, 35000.00, 0.00,     215150.00, NULL);
