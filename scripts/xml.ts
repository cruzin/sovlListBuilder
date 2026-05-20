export type XmlNode = {
  name: string
  attributes: Record<string, string>
  children: XmlNode[]
  text: string
}

const XML_DECLARATION = /^<\?xml[\s\S]*?\?>/

export function parseXml(xml: string): XmlNode {
  const root: XmlNode = {
    name: '#document',
    attributes: {},
    children: [],
    text: '',
  }
  const stack = [root]
  const source = xml.replace(XML_DECLARATION, '')
  const tokenPattern = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>|[^<]+/g
  let token: RegExpExecArray | null

  while ((token = tokenPattern.exec(source)) !== null) {
    const value = token[0]
    const parent = stack[stack.length - 1]

    if (value.startsWith('<!--')) {
      continue
    }

    if (value.startsWith('<![CDATA[')) {
      parent.text += value.slice(9, -3)
      continue
    }

    if (!value.startsWith('<')) {
      const text = decodeEntities(value.trim())
      if (text) {
        parent.text += text
      }
      continue
    }

    if (value.startsWith('</')) {
      const closingName = stripNamespace(value.slice(2, -1).trim())
      const current = stack.pop()
      if (!current || current.name !== closingName) {
        throw new Error(`Unexpected closing tag </${closingName}>`)
      }
      continue
    }

    if (value.startsWith('<!')) {
      continue
    }

    const selfClosing = value.endsWith('/>')
    const body = value.slice(1, selfClosing ? -2 : -1).trim()
    const firstWhitespace = body.search(/\s/)
    const rawName = firstWhitespace === -1 ? body : body.slice(0, firstWhitespace)
    const attributesSource = firstWhitespace === -1 ? '' : body.slice(firstWhitespace + 1)
    const node: XmlNode = {
      name: stripNamespace(rawName),
      attributes: parseAttributes(attributesSource),
      children: [],
      text: '',
    }
    parent.children.push(node)

    if (!selfClosing) {
      stack.push(node)
    }
  }

  if (stack.length !== 1) {
    throw new Error(`Unclosed XML tag <${stack[stack.length - 1].name}>`)
  }

  const documentElement = root.children.find((child) => child.name !== '?xml')
  if (!documentElement) {
    throw new Error('XML document has no root element')
  }
  return documentElement
}

export function childrenNamed(node: XmlNode | undefined, name: string): XmlNode[] {
  return node?.children.filter((child) => child.name === name) ?? []
}

export function firstChild(node: XmlNode | undefined, name: string): XmlNode | undefined {
  return node?.children.find((child) => child.name === name)
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  const attributePattern = /([:\w.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g
  let match: RegExpExecArray | null

  while ((match = attributePattern.exec(source)) !== null) {
    attributes[stripNamespace(match[1])] = decodeEntities(match[3] ?? match[4] ?? '')
  }

  return attributes
}

function stripNamespace(name: string): string {
  return name.includes(':') ? name.slice(name.indexOf(':') + 1) : name
}

function decodeEntities(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}
