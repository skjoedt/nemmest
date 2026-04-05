export function formatPrice(p: number): string {
	const [int, dec] = p.toFixed(2).split('.');
	return dec === '00' ? `${int},-` : `${int},${dec}`;
}
