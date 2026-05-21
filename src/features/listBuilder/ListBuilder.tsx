import { useEffect, useMemo, useState } from 'react'
import catalogue from '../../data/generated/catalogue.json'
import type { CatalogueFaction, CatalogueUnit, ForceFormat } from '../../types/catalogue'
import type { ArmyListItem } from './listBuilderTypes'
import { useLocalArmyList } from './useLocalArmyList'
import {
  clampModelCount,
  exportArmyList,
  formatPoints,
  getAddUnitBlockReason,
  getArmyLimitWarnings,
  getCategoryUsage,
  getEffectiveModel,
  getForceById,
  getListItemCost,
  getRetinueCount,
  getRetinueSelection,
  getSelectedRetinueUnit,
  getUnitById,
  listTotal,
  makeListItem,
  makeRetinueListItem,
  publicAssetUrl,
} from './listBuilderUtils'
import './ListBuilder.css'

const factions = catalogue.factions as CatalogueFaction[]

export function ListBuilder() {
  const defaultFactionId = factions[0]?.id ?? ''
  const { factionId, setFactionId, forceId, setForceId, items, setItems, save, clear, lastSavedAt } =
    useLocalArmyList(defaultFactionId)
  const faction = factions.find((item) => item.id === factionId) ?? factions[0]
  const force = getForceById(faction, forceId)
  const [selectedUnitId, setSelectedUnitId] = useState(faction?.units[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')

  const selectedUnit = faction?.units.find((unit) => unit.id === selectedUnitId) ?? faction?.units[0]
  const categories = useMemo(() => {
    const values = new Set<string>()
    faction?.units.forEach((unit) => unit.categories.forEach((item) => values.add(item)))
    return ['All', ...Array.from(values).sort()]
  }, [faction])
  const filteredUnits = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return (
      faction?.units.filter((unit) => {
        const matchesCategory = category === 'All' || unit.categories.includes(category)
        const matchesQuery =
          !normalizedQuery ||
          unit.name.toLowerCase().includes(normalizedQuery) ||
          unit.rulesUnitType?.toLowerCase().includes(normalizedQuery)
        return matchesCategory && matchesQuery
      }) ?? []
    )
  }, [category, faction, query])
  const total = listTotal(faction, items)
  const limitWarnings = getArmyLimitWarnings(faction, items, force)
  const categoryUsage = getCategoryUsage(faction, items, force)

  useEffect(() => {
    if (!faction || !force) {
      return
    }

    setItems((current) => {
      let changed = false
      const nextItems = current.map((item) => {
        const unit = getUnitById(faction, item.unitId)
        if (!unit) {
          return item
        }
        const minCountOverride = item.retinueForItemId ? getRetinueCount(unit, force) : undefined
        const count = clampModelCount(unit, item.count, force, minCountOverride)
        if (count === item.count) {
          return item
        }
        changed = true
        return { ...item, count }
      })
      return changed ? nextItems : current
    })
  }, [faction, force, setItems])

  function handleFactionChange(nextFactionId: string) {
    const nextFaction = factions.find((item) => item.id === nextFactionId)
    setFactionId(nextFactionId)
    setItems([])
    setSelectedUnitId(nextFaction?.units[0]?.id ?? '')
    setCategory('All')
    setQuery('')
  }

  function addUnit(unit: CatalogueUnit) {
    const nextItem = makeListItem(unit, force)
    const retinueGroup = getRetinueSelection(unit, nextItem)
    const retinueUnit = getSelectedRetinueUnit(faction, unit, nextItem)
    const retinueItem =
      retinueGroup && retinueUnit ? makeRetinueListItem(retinueUnit, nextItem, retinueGroup.id, force) : undefined
    setItems((current) => [...current, nextItem, ...(retinueItem ? [retinueItem] : [])])
  }

  function updateItem(nextItem: ArmyListItem) {
    setItems((current) => {
      const unit = getUnitById(faction, nextItem.unitId)
      const retinueGroup = unit ? getRetinueSelection(unit, nextItem) : undefined
      const retinueUnit = unit ? getSelectedRetinueUnit(faction, unit, nextItem) : undefined
      const retinueItem =
        retinueGroup && retinueUnit ? makeRetinueListItem(retinueUnit, nextItem, retinueGroup.id, force) : undefined
      const withoutOldRetinue = current.filter((item) => item.retinueForItemId !== nextItem.id)
      const updated = withoutOldRetinue.map((item) => (item.id === nextItem.id ? nextItem : item))
      if (!retinueItem) {
        return updated
      }
      const commanderIndex = updated.findIndex((item) => item.id === nextItem.id)
      return [...updated.slice(0, commanderIndex + 1), retinueItem, ...updated.slice(commanderIndex + 1)]
    })
  }

  function removeItem(itemToRemove: ArmyListItem) {
    setItems((current) =>
      current.filter((item) => item.id !== itemToRemove.id && item.retinueForItemId !== itemToRemove.id),
    )
  }

  async function copyExport() {
    if (!faction) {
      return
    }
    await navigator.clipboard.writeText(exportArmyList(faction, items, force))
    setCopyState('copied')
    window.setTimeout(() => setCopyState('idle'), 1600)
  }

  return (
    <main className="app-shell">
      <aside className="faction-rail" aria-label="Factions">
        <div className="brand-block">
          <span className="eyebrow">SOVL</span>
          <h1>List Builder</h1>
        </div>
        <div className="faction-list">
          {factions.map((item) => (
            <button
              className={item.id === faction?.id ? 'faction-button active' : 'faction-button'}
              key={item.id}
              onClick={() => handleFactionChange(item.id)}
              type="button"
            >
              <span>{item.name}</span>
              <strong>{item.units.length}</strong>
            </button>
          ))}
        </div>
      </aside>

      <section className="unit-workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">{faction?.name}</p>
            <h2>Unit Browser</h2>
          </div>
          <div className="toolbar">
            <select aria-label="Army size" onChange={(event) => setForceId(event.target.value)} value={force?.id ?? ''}>
              {faction?.forces.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.pointLimit ? ` (${item.pointLimit} pts)` : ''}
                </option>
              ))}
            </select>
            <input
              aria-label="Search units"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search units or types"
              type="search"
              value={query}
            />
            <select aria-label="Filter category" onChange={(event) => setCategory(event.target.value)} value={category}>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className="content-grid">
          <section className="unit-list" aria-label="Available units">
            {filteredUnits.map((unit) => (
              <button
                className={unit.id === selectedUnit?.id ? 'unit-row selected' : 'unit-row'}
                key={unit.id}
                onClick={() => setSelectedUnitId(unit.id)}
                type="button"
              >
                <img alt="" src={publicAssetUrl(unit.iconUrl)} />
                <span>
                  <strong>{unit.name}</strong>
                  <small>{unit.rulesUnitType ?? unit.categories.join(', ')}</small>
                </span>
                <b>{formatPoints(unit.model?.pointsPerModel ?? 0)}</b>
              </button>
            ))}
          </section>

          {selectedUnit && (
            <UnitDetails
              blockReason={getAddUnitBlockReason(faction, items, force, selectedUnit)}
              force={force}
              key={selectedUnit.id}
              unit={selectedUnit}
              onAdd={() => addUnit(selectedUnit)}
            />
          )}
        </div>
      </section>

      <aside className="army-panel" aria-label="Current army list">
        <div className="army-header">
          <div>
            <p className="eyebrow">Current List</p>
            <h2>{formatPoints(total)}</h2>
            {force?.pointLimit !== undefined && (
              <p className={total > force.pointLimit ? 'limit-note over' : 'limit-note'}>
                {force.name} limit: {formatPoints(force.pointLimit)}
              </p>
            )}
          </div>
          <span>{items.length} units</span>
        </div>

        {force && (
          <div className="limit-summary" aria-label={`${force.name} limits`}>
            {force.categoryLimits.map((limit) => {
              const current = categoryUsage.get(limit.id) ?? 0
              const isOver = limit.max !== undefined && current > limit.max
              const isUnder = limit.min !== undefined && current < limit.min
              return (
                <span className={isOver || isUnder ? 'limit-chip warning' : 'limit-chip'} key={limit.id}>
                  {limit.name}: {current}
                  {limit.max !== undefined ? `/${limit.max}` : ''}
                  {limit.min !== undefined && limit.min > 0 ? ` min ${limit.min}` : ''}
                </span>
              )
            })}
          </div>
        )}

        {limitWarnings.length > 0 && (
          <div className="limit-warnings" role="status">
            {limitWarnings.slice(0, 4).map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}

        <div className="army-actions">
          <button onClick={save} type="button">
            Save
          </button>
          <button onClick={clear} type="button">
            Clear
          </button>
          <button disabled={items.length === 0} onClick={copyExport} type="button">
            {copyState === 'copied' ? 'Copied' : 'Copy'}
          </button>
        </div>
        {lastSavedAt && <p className="save-note">Saved {new Date(lastSavedAt).toLocaleString()}</p>}

        <div className="army-items">
          {items.length === 0 && <p className="empty-state">Add units from the browser to start a list.</p>}
          {items.map((item) => {
            const unit = getUnitById(faction, item.unitId)
            if (!unit) {
              return null
            }
            return (
              <ArmyListCard
                item={item}
                key={item.id}
                onChange={updateItem}
                onRemove={() => removeItem(item)}
                force={force}
                unit={unit}
              />
            )
          })}
        </div>
      </aside>
    </main>
  )
}

function UnitDetails({
  blockReason,
  force,
  unit,
  onAdd,
}: {
  blockReason?: string
  force?: ForceFormat
  unit: CatalogueUnit
  onAdd: () => void
}) {
  const effectiveModel = getEffectiveModel(unit, force)
  const statEntries = [
    ['Move', unit.stats.movement],
    ['Skill', unit.stats.skill],
    ['Power', unit.stats.power],
    ['Defense', unit.stats.defense],
    ['Attacks', unit.stats.attacks],
    ['Wounds', unit.stats.wounds],
    ['Discipline', unit.stats.discipline],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))

  return (
    <article className="unit-detail">
      <div className="unit-art">
        <img alt="" src={publicAssetUrl(unit.imageUrl)} />
      </div>
      <div className="unit-detail-body">
        <div className="unit-title-row">
          <div>
            <p className="eyebrow">{unit.rulesUnitType ?? unit.categories.join(', ')}</p>
            <h3>{unit.name}</h3>
          </div>
          <button disabled={Boolean(blockReason)} onClick={onAdd} title={blockReason} type="button">
            Add
          </button>
        </div>
        <div className="stat-grid">
          {statEntries.map(([label, value]) => (
            <span key={label}>
              <small>{label}</small>
              <strong>{value}</strong>
            </span>
          ))}
        </div>
        <div className="detail-meta">
          <span>{effectiveModel?.defaultCount ?? 1} models default</span>
          <span>{formatPoints(unit.model?.pointsPerModel ?? 0)} per model</span>
          {effectiveModel?.minCount !== undefined && <span>Min {effectiveModel.minCount}</span>}
          {unit.maxSelections !== undefined && <span>Max {unit.maxSelections}</span>}
          {unit.stats.baseSize && <span>{unit.stats.baseSize} base</span>}
        </div>
        {blockReason && <p className="add-note">{blockReason}</p>}
        {unit.rules.length > 0 && (
          <div className="rules-list">
            {unit.rules.slice(0, 5).map((rule) => (
              <p key={rule.id}>
                <strong>{rule.name}</strong>
                {rule.text && <span>{rule.text}</span>}
              </p>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

function ArmyListCard({
  force,
  item,
  onChange,
  onRemove,
  unit,
}: {
  force?: ForceFormat
  item: ArmyListItem
  onChange: (item: ArmyListItem) => void
  onRemove: () => void
  unit: CatalogueUnit
}) {
  const cost = getListItemCost(unit, item)
  const retinueMinCount = item.retinueForItemId ? getRetinueCount(unit, force) : undefined

  return (
    <article className="army-card">
      <div className="army-card-heading">
        <img alt="" src={publicAssetUrl(unit.iconUrl)} />
        <div>
          <strong>{unit.name}</strong>
          <small>
            {item.retinueForItemId ? 'Retinue - ' : ''}
            {formatPoints(cost)}
          </small>
        </div>
        <button aria-label={`Remove ${unit.name}`} onClick={onRemove} type="button">
          X
        </button>
      </div>

      <label className="count-control">
        <span>Models</span>
        <input
          max={unit.model?.maxCount ?? 99}
          min={retinueMinCount ?? getEffectiveModel(unit, force)?.minCount ?? 1}
          onChange={(event) =>
            onChange({
              ...item,
              count: clampModelCount(unit, Number(event.target.value), force, retinueMinCount),
            })
          }
          type="number"
          value={item.count}
        />
      </label>

      {unit.optionGroups.map((group) => (
        <label className="option-control" key={group.id}>
          <span>{group.name}</span>
          <select
            onChange={(event) => {
              const selectedOptions = item.selectedOptions.filter((selected) => selected.groupId !== group.id)
              if (event.target.value) {
                selectedOptions.push({ groupId: group.id, optionId: event.target.value })
              }
              onChange({ ...item, selectedOptions })
            }}
            value={
              item.selectedOptions.find((selected) => selected.groupId === group.id)?.optionId ??
              (group.min && group.min > 0 ? group.options[0]?.id : '') ??
              ''
            }
          >
            {group.min === 0 && <option value="">None</option>}
            {group.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.points ? ` (+${option.points})` : ''}
              </option>
            ))}
          </select>
        </label>
      ))}
    </article>
  )
}
