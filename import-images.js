import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import sharp from "sharp";

// ========= CONFIG =========

const PIXABAY_KEY = "15684367-90269c35865a8ffc3dd836db5";
const SUPABASE_URL = "https://wzdtbfmhsjlchlmkltch.supabase.co";
const SUPABASE_KEY =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6ZHRiZm1oc2psY2hsbWtsdGNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTcyNDM5NywiZXhwIjoyMDgxMzAwMzk3fQ.JSOpMQ0hwllMw5UXc6hedt4odsZgynFV1_4j6ZTY-W8"; // server key for uploads

const BUCKET = "images";
const FOLDER = "pixabay_ai_all";

const MAX_IMAGES = 3000;

// BROADEST QUERY LIST to maximize AI results
const QUERIES = [
	"art",
	"design",
	"background",
	"wallpaper",
	"abstract",
	"pattern",
	"texture",
	"nature",
	"landscape",
	"animals",
	"people",
	"portrait",
	"technology",
	"object",
	"flowers",
	"scenery",
	"fantasy",
	"digital",
	"surreal",
	"illustration",
	"colorful",
	"environment",
	"minimalist",
	"creative",
	"city",
	"building",
	"sky",
	"shape",
];
// ================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Detect categories automatically
function detectCategories(tagsArray) {
	const text = tagsArray.join(" ");
	const categories = [];

	if (/animal|dog|cat|bird|wildlife/i.test(text)) categories.push("animals");
	if (/nature|forest|tree|mountain|river|landscape/i.test(text))
		categories.push("nature");
	if (/person|people|woman|man|face|portrait/i.test(text))
		categories.push("people");
	if (/city|building|architecture|urban|street/i.test(text))
		categories.push("buildings");
	if (/food|fruit|vegetable|meal|dish/i.test(text)) categories.push("food");
	if (/computer|tech|technology|device/i.test(text))
		categories.push("technology");
	if (/car|vehicle|transport|train/i.test(text)) categories.push("transport");
	if (/sport|game|athlete|fitness/i.test(text)) categories.push("sports");

	if (categories.length === 0) categories.push("general");
	return categories;
}

// Sleep helper for rate-limit handling
function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}

// SAFE fetch function that skips empty + handles rate limits
async function fetchPixabayAI(query) {
	const perPage = 200;
	let results = [];
	let page = 1;

	while (page <= 5) {
		const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}
      &q=${encodeURIComponent(query)}
      &image_type=photo
      &ai_generated=true
      &safesearch=true
      &per_page=${perPage}
      &page=${page}`.replace(/\s+/g, "");

		try {
			const res = await axios.get(url);

			// CASE 1 — NO results for this page → stop safely
			if (!res.data.hits || res.data.hits.length === 0) {
				console.log(`No AI results for "${query}" page ${page}. Skipping.`);
				break;
			}

			results = results.concat(res.data.hits);
			page++;
		} catch (err) {
			// CASE 2 — RATE LIMIT (429)
			if (err.response?.status === 429) {
				console.log("Rate limit hit. Waiting 3 seconds...");
				await sleep(3000);
				continue; // retry same page
			}

			// CASE 3 — PAGE OUT OF RANGE
			if (err.response?.status === 400) {
				console.log(`Pixabay says page out of range for "${query}".`);
				break;
			}

			console.log("Unexpected error, skipping this query:", err.message);
			break;
		}
	}

	return results;
}

// Download + compress
async function downloadAndCompress(url) {
	const res = await axios.get(url, { responseType: "arraybuffer" });

	return await sharp(res.data).resize(1024).jpeg({ quality: 75 }).toBuffer();
}

// Upload to storage
async function uploadToSupabase(buffer, filename) {
	const storagePath = `${FOLDER}/${filename}`;

	const { error } = await supabase.storage
		.from(BUCKET)
		.upload(storagePath, buffer, {
			contentType: "image/jpeg",
			upsert: true,
		});

	if (error) throw error;

	const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
	return { publicUrl: data.publicUrl };
}

// Insert row into table
async function insertImageRecord({ filename, url, tags, categories }) {
	const { error } = await supabase.from("images").insert({
		filename,
		url,
		tags,
		categories,
	});

	if (error) throw error;
}

// MAIN CONTROLLER
async function run() {
	console.log("🚀 Starting multi-query AI image import…");

	const seen = new Set();
	const allImages = [];

	for (const query of QUERIES) {
		if (allImages.length >= MAX_IMAGES) break;

		console.log(`🔍 Query: ${query}`);

		const imgs = await fetchPixabayAI(query);

		for (const img of imgs) {
			if (allImages.length >= MAX_IMAGES) break;
			if (!img.id) continue;
			if (seen.has(img.id)) continue;

			seen.add(img.id);
			allImages.push(img);
		}

		console.log(`→ Total so far: ${allImages.length}`);
	}

	console.log(`\n📦 Final collected: ${allImages.length} images.`);
	console.log("Uploading to Supabase…");

	for (const img of allImages) {
		try {
			const tagsArray = img.tags
				? img.tags.split(",").map((t) => t.trim().toLowerCase())
				: [];

			const categories = detectCategories(tagsArray);

			const buffer = await downloadAndCompress(img.largeImageURL);

			const filename = `${crypto.randomUUID()}.jpg`;

			const { publicUrl } = await uploadToSupabase(buffer, filename);

			await insertImageRecord({
				filename,
				url: publicUrl,
				tags: tagsArray,
				categories,
			});

			console.log(`✔ Uploaded: ${filename}`);
		} catch (err) {
			console.error("❌ Import error:", err.message);
		}
	}

	console.log("\n🎉 DONE — All AI-generated images imported safely.");
}

run();
