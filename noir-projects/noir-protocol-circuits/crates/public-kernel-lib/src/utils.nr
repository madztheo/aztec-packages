use dep::types::{
    abis::{
    call_request::CallRequest, public_data_read::PublicDataRead,
    public_data_update_request::PublicDataUpdateRequest
},
    address::AztecAddress,
    contrakt::{storage_read::StorageRead, storage_update_request::StorageUpdateRequest},
    utils::{arrays::array_eq}
};

pub fn compute_public_data_reads<N>(contract_address: AztecAddress, read_requests: [StorageRead; N]) -> [PublicDataRead; N] {
    let mut public_data_reads = [PublicDataRead::empty(); N];
    for i in 0..N {
        let read_request = read_requests[i];
        if !read_request.is_empty() {
            public_data_reads[i] = PublicDataRead::from_contract_storage_read(contract_address, read_request);
        }
    }
    public_data_reads
}

pub fn assert_eq_call_requests<N, S>(call_requests: [CallRequest; N], expected: [CallRequest; S]) {
    assert(array_eq(call_requests, expected));
}

pub fn compute_public_data_update_requests<N>(
    contract_address: AztecAddress,
    update_requests: [StorageUpdateRequest; N]
) -> [PublicDataUpdateRequest; N] {
    let mut public_data_update_requests = [PublicDataUpdateRequest::empty(); N];
    for i in 0..N {
        let update_request = update_requests[i];
        if !update_request.is_empty() {
            public_data_update_requests[i] = PublicDataUpdateRequest::from_contract_storage_update_request(contract_address, update_request);
        }
    }
    public_data_update_requests
}

pub fn assert_eq_public_data_reads<N, S>(public_data_reads: [PublicDataRead; N], expected: [PublicDataRead; S]) {
    assert(array_eq(public_data_reads, expected));
}

pub fn assert_eq_public_data_update_requests<N, S>(
    public_data_update_requests: [PublicDataUpdateRequest; N],
    expected: [PublicDataUpdateRequest; S]
) {
    assert(array_eq(public_data_update_requests, expected));
}
