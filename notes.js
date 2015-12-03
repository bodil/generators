//----------------

ponies = [
  "Applejack",
  "Fluttershy",
  "Pinkie Pie",
  "Rainbow Dash",
  "Rarity",
  "Twilight Sparkle"
];

i = ponies.values();
i.next();

for (let i of ponies) console.log(i);

//----------------

i = ponies[Symbol.iterator]();
i.next();

Array.from(ponies);

&ponies;

//----------------

i = infinity[Symbol.iterator]();
for (let i of infinity) console.log(i); // nope!
&infinity; // safe!

//----------------

&take(5, infinity);
for (let i of take(5, infinity)) console.log(i);

//----------------

&take(5, infinity);
&map(i => i + 5, take(5, infinity));
&take(5, map(i => i + 5, infinity));

//----------------

infinity = function*() {
  let c = 0;
  while (true) {
    yield c++;
  }
};

i = infinity();
i.next();
&infinity();

take = function*(num, iter) {
  let c = 0, next;
  while (c++ < num && !(next = iter.next()).done) {
    yield next.value;
  }
};

&take(5, infinity());

//----------------

map = function*(fn, iter) {
  let next;
  while(!(next = iter.next()).done) {
    yield fn(next.value);
  }
};

&map(i => i + "omg ", take(5, infinity()));

//----------------

i = fiveup();
i.next();
i.next(5);
i.next(100);
i.next(-50);
i.next(1000000);

// wait... so what if we yield promises?

//----------------

unit(5).then(console.log);
&unit(5);

promises = function*() {
  console.log(yield unit("omg"));
  console.log(yield unit("wtf"));
  console.log(yield unit("bbq"));
};

i = promises();
i.next();
i.next("lol");
i.next(1337);
i.next(NaN);
i.next(-Infinity);

run = (iter, val = null) => {
  const next = iter.next(val);
  if (!next.done) {
    next.value.then(result => run(iter, result));
  }
};

run(promises());

//----------------

fetch("/data/fallout.txt");
&fetch("/data/fallout.txt");
&fetch("/data/fallout.txt").then(result => result.text());

fallout = function*() {
  const response = yield fetch("/data/fallout.txt");
  const text = yield response.text();
  console.log(text);
};

run(fallout());

//----------------

// add done argument, expand if block,
// ADD DONE TO THEN, add return statement.
run = (iter, val = null, done = Promise.defer()) => {
  const next = iter.next(val);
  if (!next.done) {
    next.value.then(result => run(iter, result, done));
  } else {
    done.resolve(next.value);
  }
  return done.promise;
};

fetchText = function*(url) {
  return yield (yield fetch(url)).text();
};

&run(fetchText("/data/novel.txt"));
&run(fetchText("/data/fallout.txt"));

//----------------

// works for not just promises, but anything shaped like a promise

&run(things());

maybe = (val) => ({
  then: (fn) => val != null ? fn(val) : null
});

// ie. if val is null, we simply don't call the `then` callback,
// and return null immediately instead.

&maybe(5);
&maybe(5).then(i => maybe(6));
&maybe(null).then(i => maybe(6));
&maybe("null").then(i => maybe(6));

prop = (key, obj) => maybe(obj[key]);

&prop("pie", ponies);
&prop("twi", ponies);

things = function*() {
  const dash = yield prop("dash", ponies);
  const pie = yield prop("pie", ponies);
  //const twi = yield prop("twi", ponies);
  return dash + " is friends with " + pie;
}

&run(things());
