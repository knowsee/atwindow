/**
 * 浏览器端根据接口返回的 JSON 生成 .xlsx 并触发下载（不依赖后端导出接口）。
 * 依赖：`xlsx`
 */

export const EXPORT_PAGE_SIZE = 5000

/**
 * @param {string} [prefix]
 * @returns {string} 如 `库存数据_20260417_153045`
 */
export function makeExportBasename(prefix = 'export') {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')

  return `${prefix}_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

/**
 * @param {object} opts
 * @param {string} opts.filename 文件名，可带或不带 `.xlsx`
 * @param {string} [opts.sheetName] 工作表名（最长约 31 字符）
 * @param {Array<{ key: string, title: string }>} opts.columns 列定义：数据字段 key + 表头文案
 * @param {Array<Record<string, unknown>>} opts.rows 行数据，与 columns[].key 对应
 */
export async function downloadXlsx({ filename, sheetName = '数据', columns, rows }) {
  const XLSX = await import('xlsx')

  const headers = columns.map(c => c.title)
  const keys = columns.map(c => c.key)

  const dataRows = rows.map(row => {
    return keys.map(k => {
      const v = row[k]
      if (v === null || v === undefined)
        return ''
      if (typeof v === 'object')
        return JSON.stringify(v)

      return v
    })
  })

  const aoa = [headers, ...dataRows]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()

  const safeSheet = String(sheetName)
    .replace(/[:\\/?*[\]]/g, '_')
    .slice(0, 31) || 'Sheet1'

  XLSX.utils.book_append_sheet(wb, ws, safeSheet)

  const out = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`

  XLSX.writeFile(wb, out)
}
