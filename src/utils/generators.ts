const NO_VALUE = Symbol("NO_VALUE");

export async function lastX<A>(as: AsyncGenerator<A>): Promise<A> {
	let lastValue: A | typeof NO_VALUE = NO_VALUE;
	for await (const a of as) {
		lastValue = a;
	}
	if (lastValue === NO_VALUE) {
		throw new Error("No items in generator");
	}
	return lastValue;
}

type QueuedGenerator<A> = {
	done?: boolean;
	value?: A;
	generator: AsyncGenerator<A, void>;
	promise: Promise<QueuedGenerator<A>>;
};

// Run all generators concurrently up to a concurrency cap, yielding values as they come in
export async function* all<A>(
	generators: AsyncGenerator<A, void>[],
	concurrencyCap = Number.POSITIVE_INFINITY,
): AsyncGenerator<A, void> {
	const next = (generator: AsyncGenerator<A, void>) => {
		const promise: Promise<QueuedGenerator<A>> = generator
			.next()
			.then(({ done, value }) => ({
				done,
				value,
				generator,
				promise,
			}));
		return promise;
	};
	const waiting = [...generators];
	const promises = new Set<Promise<QueuedGenerator<A>>>();

	// Start initial batch up to concurrency cap
	while (promises.size < concurrencyCap && waiting.length > 0) {
		// biome-ignore lint/style/noNonNullAssertion: while condition checks for waiting to be non-empty
		const gen = waiting.shift()!;
		promises.add(next(gen));
	}

	while (promises.size > 0) {
		const { done, value, generator, promise } = await Promise.race(promises);
		promises.delete(promise);

		if (!done) {
			promises.add(next(generator));
			// TODO: Clean this up
			if (value !== undefined) {
				yield value;
			}
		} else if (waiting.length > 0) {
			// Start a new generator when one finishes
			// biome-ignore lint/style/noNonNullAssertion: branch requires waiting to be non-empty
			const nextGen = waiting.shift()!;
			promises.add(next(nextGen));
		}
	}
}
