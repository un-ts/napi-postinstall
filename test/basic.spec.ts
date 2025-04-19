import echo from 'native-postinstall'

test('it should just work', () => {
  expect(echo()).toBe('Hello World!')
})
