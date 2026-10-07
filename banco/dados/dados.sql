-- Executado uma única vez pelo inicializador. Dados fictícios para demonstração.
INSERT INTO produtos (nome, categoria, preco, estoque, estoque_minimo) VALUES
('Caderno universitário', 'Papelaria', 24.90, 40, 10),
('Caneta esferográfica azul', 'Papelaria', 3.50, 120, 20),
('Garrafa térmica 500 ml', 'Acessórios', 59.90, 18, 5),
('Mochila casual', 'Acessórios', 129.90, 8, 3),
('Marcador de texto', 'Papelaria', 7.90, 6, 8),
('Bloco de notas adesivas', 'Escritório', 12.50, 30, 10);

INSERT INTO movimentacoes (produto_id, tipo, quantidade)
SELECT id, 'entrada', estoque FROM produtos WHERE estoque > 0;

-- As amostras também passam pela procedure: estoque e histórico ficam coerentes.
CALL registrar_venda(1, 2, 0, 'Ana Souza', NULL);
CALL registrar_venda(3, 1, 5, 'Bruno Lima', NULL);
CALL registrar_venda(2, 10, 0, 'Carla Santos', NULL);
CALL registrar_venda(4, 1, 10, 'Diego Alves', NULL);
