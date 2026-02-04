import { readable, writable } from 'svelte/store';

// Mock for $app/stores
export const page = readable({
	url: new URL('http://localhost/qve/'),
	params: {},
	route: { id: '/' },
	status: 200,
	error: null,
	data: {},
	form: null,
});

export const navigating = readable(null);

export const updated = {
	subscribe: readable(false).subscribe,
	check: () => Promise.resolve(false),
};

export const getStores = () => ({
	page,
	navigating,
	updated,
});
