import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchSearchGateway } from '$lib/nemlig-context';
import { enforceBurstLimit } from '$lib/rate-limit';
import type { NemligProduct } from '$lib/types';

// ── Gateway product shape ─────────────────────────────────────────────────────

interface GatewayProduct {
	Id: string;
	Name: string;
	Description?: string;
	PrimaryImage?: string;
	Brand?: string;
	Price?: number;
	UnitPriceCalc?: number;
	UnitPriceLabel?: string;
	DiscountItem?: boolean;
	Url?: string;
	Campaign?: {
		CampaignPrice?: number;
		DiscountSavings?: number;
		Type?: string;
		MinQuantity?: number;
	};
}

interface GatewaySearchResponse {
	Products?: {
		Products?: GatewayProduct[];
		NumFound?: number;
	};
}

function normalizeProduct(p: GatewayProduct): NemligProduct {
	const price = p.Price ?? 0;
	const campaignPrice = p.Campaign?.CampaignPrice ?? null;
	const isOnSale = campaignPrice !== null && campaignPrice < price;
	const discountSavings = isOnSale
		? (p.Campaign?.DiscountSavings && p.Campaign.DiscountSavings > 0
			? p.Campaign.DiscountSavings
			: price - campaignPrice)
		: null;

	// UnitPriceLabel from gateway is just "kr/kg", format with UnitPriceCalc
	const unitPrice = p.UnitPriceCalc != null && p.UnitPriceLabel
		? `${p.UnitPriceCalc.toFixed(2).replace('.', ',')} ${p.UnitPriceLabel}`
		: null;

	return {
		id: p.Id,
		name: p.Name,
		description: p.Description ?? null,
		imageUrl: p.PrimaryImage ?? null,
		brand: p.Brand ?? null,
		price,
		campaignPrice,
		discountSavings,
		unitPrice,
		unitPriceLabel: p.UnitPriceLabel ?? null,
		isOnSale,
		url: p.Url ? `https://www.nemlig.com/${p.Url}` : null,
	};
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	if (q.length < 2) return json({ products: [], numFound: 0 });

	const limited = enforceBurstLimit();
	if (limited) return limited;

	const page = parseInt(url.searchParams.get('page') ?? '0', 10);
	const result = await fetchSearchGateway({
		query: q,
		take: '24',
		skip: String(page * 24),
	});

	if ('response' in result) return result.response;

	const data = result.data as GatewaySearchResponse;
	const products = data?.Products?.Products ?? [];
	const numFound = data?.Products?.NumFound ?? products.length;

	return json({
		products: products.map(normalizeProduct),
		numFound,
	});
};
