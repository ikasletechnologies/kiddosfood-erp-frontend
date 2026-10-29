import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
const mocks=vi.hoisted(()=>({save:vi.fn().mockResolvedValue({data:{}}),list:vi.fn().mockResolvedValue({data:[]})}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock('@/lib/recipe-export',()=>({exportRecipeToPdf:vi.fn()}));
vi.mock('@/components/ui/Modal',()=>({Modal:({isOpen,children,title}:any)=>isOpen?<section aria-label={title}>{children}</section>:null}));
vi.mock('@/components/ui/SlideOver',()=>({SlideOver:()=>null}));
vi.mock('../RecipeExpensesEditor',()=>({default:()=> <div>Additional Expenses</div>}));
vi.mock('@/lib/api',()=>({
  recipesApi:{getAll:mocks.list,getCategories:()=>Promise.resolve({data:[{name:'Batters'}]}),upsert:mocks.save},
  rawMaterialsApi:{getAll:()=>Promise.resolve({data:[{id:'rice',name:'Rice',sku:'HIDDEN-CODE',unit:'KG',category:'RAW_MATERIAL'}]})},
  productsApi:{getAll:()=>Promise.resolve({data:[]})},productsFullApi:{update:vi.fn()},
  productionApi:{getCostingSettings:()=>Promise.resolve({data:{}})},
  recipeImportsApi:{list:()=>Promise.resolve({data:[]})},
}));
import RecipeMasterTab from '../RecipeMasterTab';
afterEach(()=>{cleanup();mocks.save.mockClear();mocks.list.mockResolvedValue({data:[]});});
describe('manual recipe modal',()=>{
  it('creates a 1 KG reference with 600 G Rice in one save request',async()=>{
    render(<RecipeMasterTab/>);
    fireEvent.click(await screen.findByRole('button',{name:'New Recipe'}));
    fireEvent.change(screen.getByPlaceholderText('e.g. Khakhra Classic Mix'),{target:{value:'Test Batter'}});
    fireEvent.click(screen.getByText('Select Category'));fireEvent.click(screen.getByText('Batters'));
    fireEvent.change(screen.getByLabelText('Expected Output Quantity'),{target:{value:'1'}});
    fireEvent.click(screen.getByRole('button',{name:/Add Ingredient/}));
    fireEvent.click(screen.getByText('Select...'));fireEvent.click(screen.getByText('Rice'));
    expect(screen.queryByText('HIDDEN-CODE')).toBeNull();
    fireEvent.change(screen.getByLabelText('Reference quantity 1'),{target:{value:'600'}});
    fireEvent.change(screen.getByLabelText('Ingredient unit 1'),{target:{value:'G'}});
    const buttons=screen.getAllByRole('button',{name:'Create Recipe'});fireEvent.click(buttons[buttons.length-1]);
    await waitFor(()=>expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0][0]).toMatchObject({name:'Test Batter',category:'Batters',ingredientIds:['rice'],formulation:{yieldQty:1,yieldUnit:'KG',items:[{inventoryItemId:'rice',quantity:600,unit:'G'}]}});
    expect(mocks.save.mock.calls[0][0].additionalExpenses).toBeDefined();
  });
  it('loads saved quantities and units in Edit Recipe',async()=>{
    mocks.list.mockResolvedValue({data:[{id:'r1',name:'Saved Batter',category:'Batters',yieldQty:1,yieldUnit:'KG',ingredients:[{inventoryItemId:'rice',inventoryItem:{name:'Rice'}}],activeFormulation:{id:'f1',version:1,yieldQty:1,yieldUnit:'KG',items:[{inventoryItemId:'rice',quantity:600,unit:'G'}]},additionalExpenses:[],recipeItems:[]}]});
    render(<RecipeMasterTab/>);
    fireEvent.click(await screen.findByTitle('Edit'));
    expect(screen.getByLabelText('Expected Output Quantity')).toHaveValue(1);
    expect(screen.getByLabelText('Output Unit')).toHaveValue('KG');
    expect(screen.getByLabelText('Reference quantity 1')).toHaveValue(600);
    expect(screen.getByLabelText('Ingredient unit 1')).toHaveValue('G');
    fireEvent.change(screen.getByLabelText('Reference quantity 1'),{target:{value:'650'}});
    fireEvent.click(screen.getByRole('button',{name:'Update Recipe'}));
    await waitFor(()=>expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0][0]).toMatchObject({id:'r1',formulation:{yieldQty:1,yieldUnit:'KG',items:[{inventoryItemId:'rice',quantity:650,unit:'G'}]}});
  });

});
