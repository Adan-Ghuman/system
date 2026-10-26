import assert from 'node:assert/strict';

export async function verifyBrowserOwnerAliases({ page, go, dialog, close, screenshot }) {
  async function check(label) {
    const select = dialog().getByLabel(label, { exact: true });
    await select.locator('option').filter({ hasText: 'Independent owner' }).waitFor({ state: 'attached' });
    const labels = await select.locator('option').allTextContents();
    assert.equal(labels.filter(name => name === 'Rozain Textile').length, 1);
    assert(!labels.some(name => /Rozain (Textile Godown|Knitting)/i.test(name)));
    assert.equal(await select.inputValue(), 'OWN');
  }
  await go('inventory');await page.getByRole('button', { name: 'Add / Adjust Stock', exact: true }).click();await check('Fabric owner');await screenshot('canonical-fabric-owner');await close();
  await go('dyeing');await page.getByRole('button', { name: /^Send fabric for dyeing/ }).click();await check('Fabric owner');await close();
  await go('knitting');await page.getByRole('button', { name: /^Receive knitted fabric/ }).click();await check('Fabric / yarn owner');await close();
  await go('yarn');await page.getByRole('button', { name: 'Add / correct stock', exact: true }).click();await check('Yarn owner');await close();
  await go('knitting');await page.getByRole('button', { name: /^Send yarn to a knitter/ }).click();await dialog().getByLabel('Who owns this yarn?', { exact: true }).selectOption('CLIENT');
  const clients = dialog().getByLabel('Yarn owner', { exact: true });await clients.locator('option').filter({ hasText: 'Independent owner' }).waitFor({ state: 'attached' });
  assert(!(await clients.locator('option').allTextContents()).some(name => /^Rozain (Textile(?: Godown)?|Knitting)$/i.test(name)));await close();
  console.log('PASS every fabric/yarn owner dropdown shows one Rozain Textile choice and retains independent owners.');
}
