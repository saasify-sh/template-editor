import React, { useState, useEffect, useCallback } from 'react'
import { useDebounce } from 'use-debounce'
import { Liquid } from 'liquidjs'

import debounce from 'lodash.debounce'
import handlebars from 'handlebars'
import copy from 'clipboard-copy'

import { writeStorage, useLocalStorage } from '@rehooks/local-storage'
import AceEditor from 'react-ace'
import SplitPane from 'react-split-pane'
import Frame from 'react-frame-component'
import InnerHTML from 'dangerously-set-html-content'
import Select from 'react-select'
import ClipLoader from 'react-spinners/ClipLoader'
import { ToastContainer, toast } from 'react-toastify'

import 'react-toastify/dist/ReactToastify.css'
import 'ace-builds/src-noconflict/mode-html'
import 'ace-builds/src-noconflict/mode-handlebars'
import 'ace-builds/src-noconflict/mode-liquid'
import 'ace-builds/src-noconflict/mode-css'
import 'ace-builds/src-noconflict/mode-json'
import 'ace-builds/src-noconflict/theme-monokai'

import './App.css'

import htmlExample from './html-example'
import cssExample from './css-example'
import logo from './logo.svg'

handlebars.registerHelper('json', function(obj) {
  return new handlebars.SafeString(JSON.stringify(obj))
})

const liquid = new Liquid({ cache: true })

const engines = [
  { value: 'html', label: 'HTML' },
  { value: 'handlebars', label: 'Handlebars' },
  { value: 'liquid', label: 'Liquid' }
]

function compile({ html, data, engine }) {
  switch (engine) {
    case 'handlebars':
      return handlebars.compile(html)(data)
    case 'liquid':
      return liquid.parseAndRenderSync(html, data)
    default:
      return html
  }
}

function render({ html, css, data, engine, compile: shouldCompile = false }) {
  const title = (data.settings && data.settings.title) || 'Template'
  const favicon = data.settings && data.settings.favicon
  const description =
    (data.settings && data.settings.description) || `${engine} template`
  const body = shouldCompile ? compile({ html, data, engine }) : html

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    ${favicon ? `<link rel="icon" href="${favicon}" />` : ''}
    ${description ? `<meta name="description" content="${description}" />` : ''}

    <title>${title}</title>

    <style type='text/css'>
      * {
        box-sizing: border-box;
      }

      body, html {
        height: 100%;
        padding: 0;
        margin: 0;
      }
    </style>

    <style type='text/css'>
      ${css}
    </style>
  </head>

  <body>
    ${body}
  </body>
</html>
`
}

const Editor = ({ label, mode, ...props }) => (
  <div className='Editor'>
    <div className='Editor-title'>{label}</div>

    <AceEditor
      mode={mode}
      theme='monokai'
      name={`${mode.toUpperCase()}Editor`}
      height='100%'
      width='100%'
      wrapEnabled
      setOptions={{
        tabSize: 2,
        useSoftTabs: true
      }}
      {...props}
    />
  </div>
)

const Button = ({ children, onClick }) => {
  const [loading, setLoading] = useState(false)

  return (
    <button
      className='Button'
      style={{ opacity: loading ? 0.8 : 1 }}
      disabled={loading}
      onClick={async () => {
        setLoading(true)
        await Promise.resolve(onClick())
        setLoading(false)
      }}
    >
      <span style={{ opacity: loading ? 0 : 1 }}>{children}</span>
      <span className='Button-spinner'>
        {loading && <ClipLoader size={16} color='white' />}
      </span>
    </button>
  )
}

const Preview = ({ html, css, data, engine }) => {
  const [debouncedHtml] = useDebounce(html, 500)
  const [debouncedData] = useDebounce(data, 500)
  const [debouncedEngine] = useDebounce(engine, 500)

  const [compiledHtml, setCompiledHtml] = useState(() => {
    try {
      return compile({ html, data, engine })
    } catch (err) {
      console.warn('Error compiling template; using raw HTML', err)

      return html
    }
  })

  useEffect(() => {
    try {
      const compiled = compile({
        html: debouncedHtml,
        data: debouncedData,
        engine: debouncedEngine
      })

      setCompiledHtml(compiled)
    } catch (err) {
      console.warn('Error compiling template; using raw HTML', err)
      setCompiledHtml(debouncedHtml)
    }
  }, [debouncedHtml, debouncedData, debouncedEngine])

  return (
    <div className='Preview'>
      <div className='Preview-item'>
        <div className='Preview-title'>Preview</div>

        <Frame
          className='Preview-frame'
          head={
            <>
              <style type='text/css'>
                {`
* {
box-sizing: border-box;
}
body, html, .frame-root, .frame-content, .frame-content > div {
  height: 100%;
  padding: 0;
  margin: 0;
}
`}
              </style>

              <style type='text/css'>{css}</style>
            </>
          }
        >
          <InnerHTML html={compiledHtml} />
        </Frame>
      </div>
    </div>
  )
}

const debouncedWriteStorage = debounce(
  async (data, label) => {
    writeStorage(label, data)
  },
  1000,
  { maxWait: 5000 }
)

const App = () => {
  const [storedHtml] = useLocalStorage('html')
  const [storedCss] = useLocalStorage('css')
  const [storedData] = useLocalStorage('data')
  const [storedEngine] = useLocalStorage('engine')

  const [html, setHtml] = useState(storedHtml || htmlExample)
  const [css, setCss] = useState(storedCss || cssExample)
  const [data, setData] = useState(storedData || { title: 'Hello, World!' })
  const [dataJson, setDataJson] = useState(JSON.stringify(data, null, 2))
  const [engine, setEngine] = useState(storedEngine || 'handlebars')

  const copyTemplate = useCallback(async () => {
    return copy(render({ html, css, data, engine, compile: false })).then(
      () => {
        toast.info(`Copied ${engine} template to clipboard`)
      }
    )
  }, [html, css, data, engine])

  const copyOutput = useCallback(async () => {
    return copy(render({ html, css, data, engine, compile: true })).then(() => {
      toast.info('️Copied output to clipboard')
    })
  }, [html, css, data, engine])

  useEffect(() => {
    debouncedWriteStorage(html, 'html')
  }, [html])

  useEffect(() => {
    debouncedWriteStorage(css, 'css')
  }, [css])

  useEffect(() => {
    debouncedWriteStorage(data, 'data')
  }, [data])

  useEffect(() => {
    debouncedWriteStorage(engine, 'engine')
  }, [engine])

  console.log(engine)
  const currentEngine = engines.find((e) => e.value === engine)

  return (
    <div className='App'>
      <header className='Header'>
        <div className='Header-logo'>
          <a
            href='https://github.com/saasify-sh/template-editor'
            target='_blank'
            rel='noopener noreferrer'
          >
            <img src={logo} alt='Logo' />
          </a>

          <div className='Header-logoProduct'>Template Editor</div>
        </div>

        <div className='Header-actions'>
          <div className='Header-action'>
            <a
              href='https://github.com/saasify-sh/template-editor'
              target='_blank'
              rel='noopener noreferrer'
            >
              GitHub
            </a>
          </div>

          <div className='Header-action'>
            <Button onClick={copyTemplate}>Copy Template</Button>
          </div>

          <div className='Header-action'>
            <Button onClick={copyOutput}>Copy Output</Button>
          </div>

          <div className='Header-action'>
            <Select
              className='Header-engines'
              name='Template Engine'
              value={currentEngine}
              onChange={(val) => setEngine(val.value)}
              options={engines}
            />
          </div>
        </div>
      </header>

      <ToastContainer
        position='bottom-right'
        autoClose={5000}
        hideProgressBar
        newestOnTop={false}
        closeOnClick
        pauseOnVisibilityChange
        draggable
        pauseOnHover
      />

      <main className='Main'>
        <section style={{ height: '100%', position: 'relative', flexGrow: 1 }}>
          <SplitPane defaultSize='66.7%' split='vertical'>
            <SplitPane defaultSize='50%' split='vertical' primary='second'>
              <Editor
                label={currentEngine.label}
                mode={engine}
                onChange={setHtml}
                value={html}
              />

              <Editor label='CSS' mode='css' onChange={setCss} value={css} />
            </SplitPane>

            <Editor
              label='Data'
              mode='json'
              onChange={(val) => {
                try {
                  setData(JSON.parse(val))
                  setDataJson(val)
                } catch {
                  console.warn('Error parsing JSON')
                }
              }}
              value={dataJson}
            />
          </SplitPane>
        </section>

        <Preview html={html} css={css} data={data} engine={engine} />
      </main>
    </div>
  )
}

export default App
