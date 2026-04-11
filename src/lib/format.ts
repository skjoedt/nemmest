export function formatPrice(p: number): string {
	const [int, dec] = p.toFixed(2).split('.');
	return dec === '00' ? `${int},-` : `${int},${dec}`;
}

export function formatTime(minutes: number): string {
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
