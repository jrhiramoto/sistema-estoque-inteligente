// Verificar qual situação corresponde ao ID 9
const situacoes = [
  { id: 9, nome: "Atendido" },
  { id: 15, nome: "Atendido" },
  { id: 24, nome: "Faturado" },
  // Adicionar mais conforme necessário
];

console.log("Situação ID 9:");
const sit9 = situacoes.find(s => s.id === 9);
if (sit9) {
  console.log(`  ID: ${sit9.id} - Nome: ${sit9.nome}`);
} else {
  console.log("  Não encontrada na lista");
}

console.log("\nO campo 'situacao' retornado pela API:");
console.log("  id: 9");
console.log("  valor: 1");
console.log("\nO campo 'valor' parece ser um código numérico, não o nome da situação.");
console.log("Precisamos buscar o nome da situação usando o ID 9 na lista de situações.");
