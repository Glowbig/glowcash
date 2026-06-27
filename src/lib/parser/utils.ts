// Bancos colombianos no son consistentes: a veces usan coma como separador de miles
// ("$259,000"), a veces como separador decimal ("$254,00"). Se distingue por cuántos
// dígitos quedan después del último separador: 2 dígitos = decimales, 3 = miles.
export function parseAmount(raw: string): number {
  const cleaned = raw.trim();
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    if (lastDot > lastComma) {
      return parseFloat(cleaned.replace(/,/g, ''));
    }
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }

  if (lastComma > -1) {
    const digitsAfter = cleaned.length - lastComma - 1;
    return digitsAfter === 2
      ? parseFloat(cleaned.replace(',', '.'))
      : parseFloat(cleaned.replace(/,/g, ''));
  }

  if (lastDot > -1) {
    const digitsAfter = cleaned.length - lastDot - 1;
    return digitsAfter === 2 ? parseFloat(cleaned) : parseFloat(cleaned.replace(/\./g, ''));
  }

  return parseFloat(cleaned);
}
