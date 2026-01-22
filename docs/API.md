# API Reference

## Overview

The API client is in `qve/src/lib/api/client.ts`. Types are in `types.ts`.

```typescript
import { api } from '$lib/api';

const wines = await api.getWines({ type: 'Red' });
```

## Wine Endpoints

### getWines
Fetch wines with optional filters.

```typescript
const wines = await api.getWines({
  type?: string,
  region?: string,
  producer?: string,
  year?: number,
  cellarOnly?: boolean  // Only wines with bottles > 0
});
```

**Response:** `Wine[]`

### addWine
Add a new wine with region, producer, and bottles.

```typescript
const result = await api.addWine({
  // Region (new or existing)
  regionId?: number,
  regionName?: string,
  countryId?: number,

  // Producer (new or existing)
  producerId?: number,
  producerName?: string,

  // Wine details
  wineName: string,
  year: number,
  wineTypeId: number,
  description?: string,
  tastingNotes?: string,
  pairing?: string,
  pictureURL?: string,

  // Bottle details
  bottleSize: string,
  location?: string,
  source?: string,
  price?: number,
  currency?: string,
  purchaseDate?: string
});
```

**Response:** `{ success: boolean, wineId: number }`

### updateWine
Update wine details.

```typescript
await api.updateWine(wineId, {
  wineName?: string,
  year?: number,
  wineTypeId?: number,
  description?: string,
  tastingNotes?: string,
  pairing?: string,
  pictureURL?: string
});
```

**Response:** `{ success: boolean }`

### getWineById
Fetch single wine with bottles.

```typescript
const wine = await api.getWineById(wineId);
```

**Response:** `Wine` with `bottles: Bottle[]`

## Bottle Endpoints

### addBottle
Add bottles to existing wine.

```typescript
await api.addBottle({
  wineId: number,
  quantity: number,  // Can add multiple at once
  bottleSize: string,
  location?: string,
  source?: string,
  price?: number,
  currency?: string,
  purchaseDate?: string
});
```

**Response:** `{ success: boolean }`

### updateBottle
Update bottle details.

```typescript
await api.updateBottle(bottleId, {
  bottleSize?: string,
  location?: string,
  source?: string,
  price?: number,
  currency?: string,
  purchaseDate?: string
});
```

**Response:** `{ success: boolean }`

### getBottles
Get bottles for a wine.

```typescript
const bottles = await api.getBottles(wineId);
```

**Response:** `Bottle[]`

## Rating Endpoints

### drinkBottle
Mark bottle as drunk and add rating.

```typescript
await api.drinkBottle(bottleId, {
  rating: number,         // 0-10 (required)
  valueRating?: number,   // 0-10
  notes?: string,
  complexity?: number,    // 0-5 (optional)
  drinkability?: number,  // 0-5 (optional)
  surprise?: number,      // 0-5 (optional)
  foodPairing?: string,
  buyAgain?: boolean
});
```

**Response:** `{ success: boolean }`

### getDrunkWines
Get drink history.

```typescript
const history = await api.getDrunkWines();
```

**Response:** `DrunkWine[]` (includes wine details, rating, bottle price)

## Filter Endpoints

### getTypes
Get wine types with bottle counts.

```typescript
const types = await api.getTypes({
  cellarOnly?: boolean,
  region?: string,
  producer?: string,
  year?: number
});
```

**Response:** `{ wineType: string, count: number }[]`

### getRegions
Get regions with bottle counts.

```typescript
const regions = await api.getRegions({
  cellarOnly?: boolean,
  type?: string,
  producer?: string,
  year?: number
});
```

**Response:** `{ regionId, regionName, countryName, count }[]`

### getProducers
Get producers with bottle counts.

```typescript
const producers = await api.getProducers({
  cellarOnly?: boolean,
  type?: string,
  region?: string,
  year?: number
});
```

**Response:** `{ producerId, producerName, regionName, count }[]`

### getYears
Get vintages with bottle counts.

```typescript
const years = await api.getYears({
  cellarOnly?: boolean,
  type?: string,
  region?: string,
  producer?: string
});
```

**Response:** `{ year: number, count: number }[]`

## Other Endpoints

### uploadImage
Upload wine image.

```typescript
const result = await api.uploadImage(file: File);
```

**Response:** `{ success: boolean, url: string }`

Image is resized to 800x800px with edge-sampled background.

### enrichWithAI
Get AI-generated data.

```typescript
const data = await api.enrichWithAI(
  type: 'producer' | 'region' | 'wine',
  name: string,
  context?: object
);
```

**Response:** Depends on type:
- `producer`: `{ description, founded, ownership }`
- `region`: `{ description, climate, soil }`
- `wine`: `{ description, tastingNotes, pairing }`

### getCountries
Get country list.

```typescript
const countries = await api.getCountries();
```

**Response:** `{ countryId, countryName, code }[]`

## Types

### Wine
```typescript
interface Wine {
  wineID: number;
  wineName: string;
  year: number;
  wineType: string;
  producerName: string;
  regionName: string;
  countryName: string;
  description?: string;
  tastingNotes?: string;
  pairing?: string;
  pictureURL?: string;
  bottleCount: number;
  avgRating?: number;
  bottles?: Bottle[];
}
```

### Bottle
```typescript
interface Bottle {
  bottleID: number;
  wineID: number;
  bottleSize: string;
  location?: string;
  source?: string;
  price?: number;
  currency?: string;
  purchaseDate?: string;
  dateAdded: string;
  bottleDrunk: boolean;
}
```

### DrunkWine
```typescript
interface DrunkWine {
  ratingID: number;
  wineID: number;
  wineName: string;
  year: number;
  wineType: string;
  producerName: string;
  regionName: string;
  drinkDate: string;
  overallRating: number;
  valueRating?: number;
  Notes?: string;
  complexity?: number;
  drinkability?: number;
  surprise?: number;
  foodPairing?: string;
  buyAgain?: boolean;
  bottlePrice?: number;
  bottleCurrency?: string;
}
```

## Error Handling

API methods throw on error:

```typescript
try {
  await api.addWine(data);
  toast.success('Wine added!');
} catch (error) {
  toast.error(error.message);
}
```

PHP endpoints return:
```json
{
  "success": false,
  "error": "Error message"
}
```

## PHP Backend Files

| File | Purpose |
|------|---------|
| `getWines.php` | Complex JOIN query with filters |
| `addWine.php` | 4-table transaction insert |
| `updateWine.php` | Update wine record |
| `drinkBottle.php` | Mark drunk + add rating |
| `addBottle.php` | Add bottles to wine |
| `updateBottle.php` | Update bottle record |
| `getDrunkWines.php` | History with ratings |
| `getTypes.php` | Types with counts |
| `getRegions.php` | Regions with counts |
| `getProducers.php` | Producers with counts |
| `getYears.php` | Vintages with counts |
| `getCountries.php` | Country list |
| `getBottles.php` | Bottles for wine |
| `upload.php` | Image upload/resize |
| `geminiAPI.php` | AI enrichment |
| `audit_log.php` | Change tracking |
| `databaseConnection.php` | DB connection |
