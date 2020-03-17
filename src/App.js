import React, { useState, useEffect, useCallback } from 'react'
import { useDebounce } from 'use-debounce'
import { Liquid } from 'liquidjs'

import raw from 'raw.macro'
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

import logo from './logo.svg'
import github from './github.svg'

const exampleHelloWorldHtml = raw('./examples/hello-world.hbs')
const exampleHelloWorldCss = raw('./examples/hello-world.css')
const exampleHelloWorldData = raw('./examples/hello-world.json')

const exampleRealEstateHtml = raw('./examples/real-estate.hbs')
const exampleRealEstateCss = raw('./examples/real-estate.css')
const exampleRealEstateData = raw('./examples/real-estate.json')

handlebars.registerHelper('json', function(obj) {
  return new handlebars.SafeString(JSON.stringify(obj))
})

const liquid = new Liquid({ cache: true })

const engines = [
  { value: 'html', label: 'HTML' },
  { value: 'handlebars', label: 'Handlebars' },
  { value: 'liquid', label: 'Liquid' }
]

const examples = [
  {
    value: 'hello-world',
    label: 'Hello World',
    engine: 'handlebars',
    html: exampleHelloWorldHtml,
    css: exampleHelloWorldCss,
    data: exampleHelloWorldData
  },
  {
    value: 'real-estate',
    label: 'Real Estate Gallery',
    engine: 'handlebars',
    html: exampleRealEstateHtml,
    css: exampleRealEstateCss,
    data: exampleRealEstateData
  }
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
  async ({ html, css, data, engine }) => {
    writeStorage('html', html)
    writeStorage('css', css)
    writeStorage('data', data)
    writeStorage('engine', engine)
  },
  1000,
  { maxWait: 5000 }
)

const App = () => {
  const [storedHtml] = useLocalStorage('html')
  const [storedCss] = useLocalStorage('css')
  const [storedData] = useLocalStorage('data')
  const [storedEngine] = useLocalStorage('engine')

  const [html, setHtml] = useState(storedHtml || exampleHelloWorldHtml)
  const [css, setCss] = useState(storedCss || exampleHelloWorldCss)
  const [data, setData] = useState(storedData || exampleHelloWorldData)
  const [dataJson, setDataJson] = useState(JSON.stringify(data, null, 2))
  const [engine, setEngine] = useState(storedEngine || 'handlebars')

  const copyTemplate = useCallback(async () => {
    return copy(render({ html, css, data, engine, compile: false })).then(
      () => {
        toast.info(`Copied ${engine} template file to clipboard`)
      }
    )
  }, [html, css, data, engine])

  const copyOutput = useCallback(async () => {
    return copy(render({ html, css, data, engine, compile: true })).then(() => {
      toast.info('️Copied output HTML file to clipboard')
    })
  }, [html, css, data, engine])

  useEffect(() => {
    debouncedWriteStorage({ html, css, data, engine })
  }, [html, css, data, engine])

  const currentEngine = engines.find((e) => e.value === engine)
  const currentExamples = examples.filter(
    (example) => example.engine === engine
  )

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
            <Select
              className='Header-engines'
              name='Template Engine'
              value={currentEngine}
              onChange={(val) => setEngine(val.value)}
              options={engines}
              styles={{ container: (base) => ({ ...base, zIndex: 9999 }) }}
            />
          </div>

          <div className='Header-action'>
            <Select
              className='Header-examples'
              name='Example'
              placeholder='Select Example'
              value={null}
              onChange={(val) => {
                setHtml(val.html)
                setCss(val.css)
                setData(JSON.parse(val.data))
                setDataJson(val.data)
              }}
              styles={{ container: (base) => ({ ...base, zIndex: 9999 }) }}
              options={currentExamples}
              disabled={!currentExamples.length}
            />
          </div>

          <div className='Header-action'>
            <Button onClick={copyTemplate}>Copy Template</Button>
          </div>

          <div className='Header-action'>
            <Button onClick={copyOutput}>Copy Output</Button>
          </div>

          <div className='Header-action'>
            <a
              href='https://github.com/saasify-sh/template-editor'
              target='_blank'
              rel='noopener noreferrer'
            >
              <img src={github} alt='GitHub' />
            </a>
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
