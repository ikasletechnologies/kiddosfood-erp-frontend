import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import FranchiseDocuments from '../FranchiseDocuments';
import {DOCUMENT_CATEGORIES,FranchiseDocument} from '@/lib/api/franchise-documents.api';
const mocks=vi.hoisted(()=>({list:vi.fn(),upload:vi.fn(),remove:vi.fn(),update:vi.fn(),file:vi.fn()}));
vi.mock('@/lib/api/franchise-documents.api',async importOriginal=>({...await importOriginal<any>(),franchiseDocumentsApi:mocks}));
const saved:FranchiseDocument={id:'doc-1',franchiseId:'branch-a',category:'CATALOGUE',originalFileName:'catalogue.pdf',mimeType:'application/pdf',fileSize:100,familyId:'family-1',version:1,status:'ACTIVE',visibility:'INTERNAL',uploadedBy:'hq',uploadedByName:'Super Admin',uploadedAt:'2026-10-29T04:00:00Z',updatedAt:'2026-10-29T04:00:00Z'};
const response=(documents:FranchiseDocument[]=[])=>({data:{documents,maxFileBytes:10*1024*1024}});
beforeEach(()=>{vi.clearAllMocks();mocks.list.mockResolvedValue(response());mocks.upload.mockResolvedValue({data:saved});mocks.remove.mockResolvedValue({data:{success:true}});mocks.update.mockResolvedValue({data:saved});mocks.file.mockResolvedValue({data:new Blob(['%PDF-1.4'],{type:'application/pdf'})});URL.createObjectURL=vi.fn(()=> 'blob:private-preview');URL.revokeObjectURL=vi.fn();vi.spyOn(window,'confirm').mockReturnValue(true);vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const category=()=>screen.getByRole('heading',{name:'Catalogue'}).closest('div.rounded-xl') as HTMLElement;
const openUpload=async()=>{await screen.findByRole('heading',{name:'Catalogue'});fireEvent.click(within(category()).getByRole('button',{name:'Upload'}));};

it('shows all nine optional categories and counts multiple documents in a category once',async()=>{
  mocks.list.mockResolvedValue(response([saved,{...saved,id:'legal-1',category:'LEGAL_AGREEMENTS'},{...saved,id:'legal-2',category:'LEGAL_AGREEMENTS'}]));
  render(<FranchiseDocuments franchiseId="branch-a" manage/>);
  for(const [,name] of DOCUMENT_CATEGORIES)expect(await screen.findByRole('heading',{name})).toBeVisible();
  expect(screen.getByText('Uploaded Categories: 2')).toBeVisible();expect(screen.getByText('Pending Categories: 7')).toBeVisible();
  expect(screen.getAllByText('Not Uploaded')).toHaveLength(7);
});
it('selection does not upload; explicit save sends the file to the exact franchise with private visibility',async()=>{
  render(<FranchiseDocuments franchiseId="branch-a" manage/>);await openUpload();
  fireEvent.change(screen.getByLabelText('File for Catalogue'),{target:{files:[new File(['%PDF-1.4\n%%EOF'],'catalogue.pdf',{type:'application/pdf'})]}});
  expect(mocks.upload).not.toHaveBeenCalled();expect(screen.getByLabelText('Document visibility')).toHaveValue('INTERNAL');
  mocks.list.mockResolvedValue(response([saved]));fireEvent.click(screen.getByRole('button',{name:'Upload Document'}));
  await waitFor(()=>expect(mocks.upload).toHaveBeenCalledWith('branch-a',expect.objectContaining({category:'CATALOGUE',originalFileName:'catalogue.pdf',dataBase64:expect.any(String),visibility:'INTERNAL'}),expect.any(Function)));
  expect(await screen.findByText('Document saved.')).toBeVisible();expect(await screen.findByText(/Super Admin.*0.1 KB/)).toBeVisible();
});
it('rejects unsupported and oversized files and prevents an invalid replacement from uploading',async()=>{
  render(<FranchiseDocuments franchiseId="branch-a" manage/>);await openUpload();
  fireEvent.change(screen.getByLabelText('File for Catalogue'),{target:{files:[new File(['script'],'unsafe.exe')]}});
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a PDF');expect(screen.getByRole('button',{name:'Upload Document'})).toBeDisabled();
  const large=new File(['pdf'],'large.pdf');Object.defineProperty(large,'size',{value:10*1024*1024+1});
  fireEvent.change(screen.getByLabelText('File for Catalogue'),{target:{files:[large]}});
  expect(screen.getByRole('alert')).toHaveTextContent('10 MB or smaller');expect(mocks.upload).not.toHaveBeenCalled();
});
it('supports drag-and-drop but waits for explicit upload',async()=>{
  render(<FranchiseDocuments franchiseId="branch-a" manage/>);await openUpload();
  fireEvent.drop(screen.getByLabelText('File for Catalogue').closest('label')!,{dataTransfer:{files:[new File(['pdf'],'dropped.pdf',{type:'application/pdf'})]}});
  expect(screen.getByText('Selected: dropped.pdf')).toBeVisible();expect(mocks.upload).not.toHaveBeenCalled();
});
it('replaces the selected file and fetches history only for the current franchise',async()=>{
  mocks.list.mockResolvedValue(response([saved]));render(<FranchiseDocuments franchiseId="branch-a" manage/>);
  fireEvent.click(await screen.findByRole('button',{name:'Replace'}));fireEvent.change(screen.getByLabelText('File for Catalogue'),{target:{files:[new File(['%PDF-1.4'],'replacement.pdf',{type:'application/pdf'})]}});
  fireEvent.click(screen.getByRole('button',{name:'Save Replacement'}));
  await waitFor(()=>expect(mocks.upload).toHaveBeenCalledWith('branch-a',expect.objectContaining({replaceId:'doc-1',category:'CATALOGUE'}),expect.any(Function)));
  await screen.findByText('Document saved.');fireEvent.click(screen.getByRole('checkbox',{name:'Version history'}));
  await waitFor(()=>expect(mocks.list).toHaveBeenLastCalledWith('branch-a',true));
});
it('previews and downloads through authenticated blob APIs, and releases the preview URL',async()=>{
  mocks.list.mockResolvedValue(response([saved]));render(<FranchiseDocuments franchiseId="branch-a" manage/>);
  fireEvent.click(await screen.findByRole('button',{name:'View'}));
  const preview=await screen.findByTitle('Document preview');
  expect(preview).toHaveAttribute('src','blob:private-preview');expect(preview).toHaveAttribute('referrerpolicy','no-referrer');
  // Chrome disables its native PDF viewer in sandboxed iframes.
  expect(preview).not.toHaveAttribute('sandbox');expect(mocks.file).toHaveBeenCalledWith('branch-a','doc-1',true);
  fireEvent.click(screen.getAllByRole('button',{name:'Download'})[0]);await waitFor(()=>expect(mocks.file).toHaveBeenCalledWith('branch-a','doc-1',false));
  cleanup();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-preview');
});
it('archives files and explicitly changes visibility without deleting history',async()=>{
  mocks.list.mockResolvedValue(response([saved]));render(<FranchiseDocuments franchiseId="branch-a" manage/>);
  fireEvent.click(await screen.findByRole('button',{name:'Share With Franchise'}));await waitFor(()=>expect(mocks.update).toHaveBeenCalledWith('branch-a','doc-1',{visibility:'SHARED'}));
  await screen.findByText('Visibility updated.');fireEvent.click(screen.getByRole('button',{name:'Remove'}));await waitFor(()=>expect(mocks.remove).toHaveBeenCalledWith('branch-a','doc-1'));
});
it('renders branch profile documents read-only with no history, visibility or upload actions',async()=>{
  mocks.list.mockResolvedValue(response([{...saved,visibility:'SHARED'}]));render(<FranchiseDocuments franchiseId="branch-a"/>);
  await screen.findByText(/catalogue.pdf/);expect(screen.getByText('Shared With Franchise')).toBeVisible();
  for(const name of ['Replace','Remove','Upload','Share With Franchise'])expect(screen.queryByRole('button',{name})).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).toBeNull();expect(mocks.list).toHaveBeenCalledWith('branch-a',false);
});
it('shows failures and supports refreshing the list',async()=>{
  mocks.list.mockRejectedValueOnce(new Error('offline'));render(<FranchiseDocuments franchiseId="branch-a" manage/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load');
  fireEvent.click(screen.getByRole('button',{name:'Refresh Documents'}));await screen.findByRole('heading',{name:'Catalogue'});expect(screen.queryByRole('alert')).toBeNull();
});

it('keeps the selected file after a missing-route error and allows an explicit retry',async()=>{
  mocks.upload.mockRejectedValueOnce({response:{status:404,data:'Cannot POST /api/franchise/branch-a/documents'},message:'Request failed with status code 404'});
  render(<FranchiseDocuments franchiseId="branch-a" manage/>);await openUpload();
  fireEvent.change(screen.getByLabelText('File for Catalogue'),{target:{files:[new File(['%PDF-1.4'],'retry.pdf',{type:'application/pdf'})]}});
  fireEvent.click(screen.getByRole('button',{name:'Upload Document'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Document service is temporarily unavailable');
  expect(screen.getByText('Selected: retry.pdf')).toBeVisible();
  expect(screen.getByRole('button',{name:'Upload Document'})).toBeEnabled();
  expect(mocks.upload).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'Upload Document'}));
  await screen.findByText('Document saved.');expect(mocks.upload).toHaveBeenCalledTimes(2);
});

it('does not show missing-upload status when the document list is unavailable',async()=>{
  mocks.list.mockRejectedValueOnce({response:{status:404,data:'Cannot GET documents'}});
  render(<FranchiseDocuments franchiseId="branch-a" manage/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Document service is temporarily unavailable');
  expect(screen.queryByText('Not Uploaded')).toBeNull();expect(screen.queryByRole('button',{name:'Upload'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Refresh Documents'}));await screen.findByRole('heading',{name:'Catalogue'});
});

it('removes an unsaved selected file without uploading and keeps extra fields collapsed',async()=>{
  render(<FranchiseDocuments franchiseId="branch-a" manage/>);await openUpload();
  expect(screen.getByLabelText('Document issue date')).not.toBeVisible();
  fireEvent.change(screen.getByLabelText('File for Catalogue'),{target:{files:[new File(['%PDF-1.4'],'selected.pdf',{type:'application/pdf'})]}});
  fireEvent.click(screen.getByRole('button',{name:'Remove selected file'}));
  expect(screen.queryByText('Selected: selected.pdf')).toBeNull();expect(screen.getByRole('button',{name:'Upload Document'})).toBeDisabled();
  expect(mocks.upload).not.toHaveBeenCalled();
});
