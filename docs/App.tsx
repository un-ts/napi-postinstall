import { lazy, Suspense } from 'react'
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom'

import './global.css'
import 'github-markdown-css'

const ReadmeLazy = lazy(() => import('../README.md'))

const Readme = () => (
  <Suspense>
    <ReadmeLazy />
  </Suspense>
)

const ChangelogLazy = lazy(() => import('../CHANGELOG.md'))

const Changelog = () => (
  <Suspense>
    <ChangelogLazy />
  </Suspense>
)

const readmeElement = <Readme />
const changelogElement = <Changelog />

export const App = () => (
  <Router>
    <Routes>
      <Route
        path="/CHANGELOG.md"
        element={changelogElement}
      ></Route>
      <Route
        path="/"
        element={readmeElement}
      ></Route>
    </Routes>
  </Router>
)
