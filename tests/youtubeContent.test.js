import assert from "node:assert/strict";
import test from "node:test";
import { youtubePublicationContent } from "../src/data/youtube-publication-content.js";

test("provides complete conversion metadata for every tutorial", () => {
  assert.equal(youtubePublicationContent.length, 36);
  assert.equal(new Set(youtubePublicationContent.map((item) => item.title)).size, 36);

  for (const item of youtubePublicationContent) {
    assert.ok(item.title.length <= 100, `${item.id} has a title above 100 characters`);
    assert.match(item.description, /https:\/\/studiosbook\.com\.br/);
    assert.match(item.description, /grátis por 7 dias/);
    assert.equal(item.hashtags.length, 3);
    assert.ok(item.pinnedComment.length > 80);
    assert.ok(item.tags.length <= 10);
  }
});

