import { basename, extname, parse } from 'path'
import { readFile } from 'fs/promises'

import resolvePath from 'resolve-path'

import { fileExists } from './helpers/file-exists.js'
import { getSettings } from './settings.js'
import { themesDirectory } from './helpers/paths.js'

export const registerHudRoutes = (router) => {
	router.get('/hud/:path*', async (context) => {
		const { settings, themeTree } = await getSettings()

		const path = decodeURIComponent(
			context.path.replace(/^\/hud\//, '').trim(),
		)

		// don't serve hidden files
		const pathBasename = basename(path)
		if (pathBasename.startsWith('.')) return context.status = 404

		const isIndexHtml = !path || path === '/hud'

		const body = await concatStaticFileFromThemeTreeRecursively(
			isIndexHtml ? 'index.html' : path,
			[],
			themeTree,
		)

		if (! body) return context.status = 404

		context.type = isIndexHtml ? '.html' : extname(path)
		context.body = body.join('\n')
	})
}

const concatStaticFileFromThemeTreeRecursively = async (path, concatTree, themeTree) => {
	if (! themeTree.length) return

	themeTree = themeTree.slice()
	const theme = themeTree.shift()

	const sanitizedPath = sanitizePath(`${themesDirectory}/${theme}`, path)
	if (! sanitizedPath) return

	const parsedPath = parse(sanitizedPath)
	const appendPath = `${parsedPath.dir}/${parsedPath.name}.append${parsedPath.ext}`

	if (await fileExists(appendPath)) {
		concatTree.unshift(
			concatComment(parsedPath, theme, true),
			await readFile(appendPath, 'utf-8'),
		)
	}

	if (await fileExists(sanitizedPath)) {
		concatTree.unshift(
			concatComment(parsedPath, theme, false),
			await readFile(sanitizedPath, 'utf-8'),
		)
		return concatTree
	}

	return concatStaticFileFromThemeTreeRecursively(path, concatTree, themeTree)
}

const sanitizePath = (root, path) => {
	try {
		return resolvePath(root, path)
	} catch {
		return null
	}
}

const concatComment = (parsedPath, theme, append) => {
	const commentBody = `from theme: ${theme}${append ? ' (append)' : ''}`

	switch (parsedPath.ext) {
		case '.css':
		case '.js':
			return `/* ${commentBody} */`

		case '.htm':
		case '.html':
			return `<!-- ${commentBody} -->`
	}
}