import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { ErrorBox, Field, Loader, Notice, Photo, Segmented, Toggle, useApi } from '../../components/ui'
import { AllergenChecks } from '../../components/Allergens'

const EMPTY = {
  name: '',
  category_id: '',
  base_price: '',
  product_type: 'made_to_order',
  stock_qty: '',
  lead_time_hours: '0',
  description: '',
  ingredients: '',
  allergen_ids: [],
  is_available: true,
  is_featured: false,
  is_customizable: false,
  daily_limit: '',
  sold_out_today: false,
  options: [],
}

export default function ProductForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const categories = useApi('/admin/categories')
  const allergens = useApi('/allergens')
  const [form, setForm] = useState(EMPTY)
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(editing)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState(null)

  useEffect(() => {
    if (!editing) return
    api(`/admin/products/${id}`)
      .then((d) => {
        const p = d.data
        setProduct(p)
        setForm({
          name: p.name,
          category_id: String(p.category_id),
          base_price: String(p.base_price),
          product_type: p.product_type || 'made_to_order',
          stock_qty: p.stock_qty === null || p.stock_qty === undefined ? '' : String(p.stock_qty),
          lead_time_hours: String(p.lead_time_hours),
          description: p.description || '',
          ingredients: p.ingredients || '',
          allergen_ids: (p.allergens || []).map((a) => a.id),
          is_available: !!p.is_available,
          is_featured: !!p.is_featured,
          is_customizable: !!p.is_customizable,
          daily_limit: p.daily_limit === null ? '' : String(p.daily_limit),
          sold_out_today: !!p.sold_out_today,
          options: p.options.map((o) => ({
            id: o.id,
            option_group: o.option_group,
            name: o.name,
            price_add: String(o.price_add),
            allergen_ids: (o.allergens || []).map((a) => a.id),
          })),
        })
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [editing, id])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const ready = form.product_type === 'ready_made'
  const setOption = (i, k, v) => setForm({ ...form, options: form.options.map((o, j) => (j === i ? { ...o, [k]: v } : o)) })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    setError(null)
    setNotice('')
    try {
      const body = ready ? { ...form, options: [], is_customizable: false, lead_time_hours: '1' } : { ...form, stock_qty: '' }
      const res = await api(editing ? `/admin/products/${id}` : '/admin/products', { method: editing ? 'PUT' : 'POST', body })
      let saved = res.data
      if (file) {
        const fd = new FormData()
        fd.append('image', file)
        try {
          saved = (await api(`/admin/products/${saved.id}/image`, { method: 'POST', body: fd })).data
          setFile(null)
        } catch (err) {
          setErrors(err.errors || {})
          setError(new Error(`Product saved, but the photo was not uploaded: ${err.errors?.image || err.message}`))
          if (!editing) navigate(`/admin/products/${saved.id}/edit`, { replace: true })
          setBusy(false)
          return
        }
      }
      if (editing) {
        setProduct(saved)
        setNotice(res.message)
      } else {
        navigate('/admin/products', { replace: true })
      }
    } catch (err) {
      setError(err)
      setErrors(err.errors || {})
    }
    setBusy(false)
  }

  if (loading) return <Loader variant="page" />
  const optionError = Object.entries(errors).find(([k]) => k.startsWith('options.'))?.[1]

  return (
    <form className="stack" onSubmit={save} noValidate>
      <Link to="/admin/products" className="small">
        ← Products
      </Link>
      <div className="page-head">
        <div>
          <h1>{editing ? `Edit product: ${product?.name || ''}` : 'Add product'}</h1>
          <span className="muted">{editing ? 'Changes show on the menu right away.' : 'Fill in the details, then save.'}</span>
        </div>
        <div className="actions">
          <Link to="/admin/products" className="btn">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save product'}
          </button>
        </div>
      </div>
      <Notice onClose={() => setNotice('')}>{notice}</Notice>
      <ErrorBox error={error} />

      <div className="two-col wide-left">
        <div className="stack">
          <section className="card stack">
            <h3>Details</h3>
            <Field label="Name" error={errors.name}>
              <input value={form.name} onChange={set('name')} />
            </Field>
            <div className="stack">
              <span className="field-label">Type</span>
              <Segmented
                value={form.product_type}
                onChange={(v) => setForm({ ...form, product_type: v })}
                options={[
                  { value: 'made_to_order', label: 'Made to order' },
                  { value: 'ready_made', label: 'Ready-made' },
                ]}
              />
              <span className="muted small">
                {ready
                  ? 'Already baked and sold from today’s stock. No options or cake message. Stock goes down when an order is paid.'
                  : 'Baked for each order, with options and lead time.'}
              </span>
              {errors.product_type && <span className="field-error">{errors.product_type}</span>}
            </div>
            <div className="grid-3">
              <Field label="Category" error={errors.category_id}>
                <select value={form.category_id} onChange={set('category_id')}>
                  <option value="">Choose…</option>
                  {categories.data?.data.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Base price (₱)" error={errors.base_price}>
                <input type="number" min="0" step="0.01" value={form.base_price} onChange={set('base_price')} />
              </Field>
              {ready ? (
                <Field label="In stock now" error={errors.stock_qty}>
                  <input type="number" min="0" step="1" value={form.stock_qty} placeholder="e.g. 6" onChange={set('stock_qty')} />
                </Field>
              ) : (
                <Field label="Lead time (hours)" error={errors.lead_time_hours}>
                  <input type="number" min="0" step="1" value={form.lead_time_hours} onChange={set('lead_time_hours')} />
                </Field>
              )}
            </div>
            <Field label="Description" error={errors.description}>
              <textarea rows={3} value={form.description} onChange={set('description')} />
            </Field>
            <Field label="Ingredients" error={errors.ingredients} hint="Shown on the product page. List everything, including what is in the frosting or filling.">
              <textarea rows={3} maxLength={2000} value={form.ingredients} placeholder="e.g. Flour, sugar, eggs, butter, milk" onChange={set('ingredients')} />
            </Field>
            <AllergenChecks
              label="Contains (for every version of this product)"
              all={allergens.data?.data}
              value={form.allergen_ids}
              onChange={(ids) => setForm({ ...form, allergen_ids: ids })}
            />
            <div className="row wrap">
              <Toggle checked={form.is_available} onChange={(v) => setForm({ ...form, is_available: v })} label="Available" />
              <Toggle checked={form.is_featured} onChange={(v) => setForm({ ...form, is_featured: v })} label="Featured" />
              {!ready && (
                <Toggle
                  checked={form.is_customizable}
                  onChange={(v) => setForm({ ...form, is_customizable: v })}
                  label="Customizable (cake message)"
                />
              )}
            </div>
          </section>

          {!ready && (
            <section className="card stack">
              <h3>Daily stock</h3>
              <div className="grid-2">
                <Field
                  label="Daily limit"
                  error={errors.daily_limit}
                  hint="Most that can be ordered for one pickup or delivery day. Leave empty for no limit."
                >
                  <input type="number" min="1" step="1" value={form.daily_limit} placeholder="No limit" onChange={set('daily_limit')} />
                </Field>
                <div className="stack">
                  <Toggle checked={form.sold_out_today} onChange={(v) => setForm({ ...form, sold_out_today: v })} label="Sold out today" />
                  <span className="muted small">
                    Blocks orders for today only. Customers can still order it for other days. It switches off by itself tomorrow.
                  </span>
                </div>
              </div>
            </section>
          )}

          {!ready && (
            <section className="card stack">
              <div className="section-head">
                <h3>Options</h3>
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => setForm({ ...form, options: [...form.options, { option_group: 'size', name: '', price_add: '0', allergen_ids: [] }] })}
                >
                  + Add option
                </button>
              </div>
              {optionError && <span className="field-error">{optionError}</span>}
              {form.options.length === 0 ? (
                <p className="muted small">No options. Customers order this product as is.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Group</th>
                        <th>Option</th>
                        <th>Price add (₱)</th>
                        <th>Adds allergens</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {form.options.map((o, i) => (
                        <tr key={o.id || `new-${i}`}>
                          <td>
                            <select value={o.option_group} onChange={(e) => setOption(i, 'option_group', e.target.value)}>
                              <option value="size">Size</option>
                              <option value="flavor">Flavor</option>
                              <option value="frosting">Frosting</option>
                            </select>
                          </td>
                          <td>
                            <input value={o.name} placeholder="e.g. 8 inch" onChange={(e) => setOption(i, 'name', e.target.value)} />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={o.price_add}
                              onChange={(e) => setOption(i, 'price_add', e.target.value)}
                            />
                          </td>
                          <td>
                            <AllergenChecks all={allergens.data?.data} value={o.allergen_ids || []} onChange={(ids) => setOption(i, 'allergen_ids', ids)} />
                          </td>
                          <td className="right">
                            <button
                              type="button"
                              className="link-button danger"
                              onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>

        <section className="card stack">
          <h3>Photo</h3>
          <Photo src={file ? URL.createObjectURL(file) : product?.image_url} alt="" className="large" />
          <Field error={errors.image} hint="JPG, PNG or WEBP, up to 2 MB. Uploaded when you save.">
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files[0] || null)} />
          </Field>
        </section>
      </div>
    </form>
  )
}
