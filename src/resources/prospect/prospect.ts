// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as CompaniesAPI from './companies';
import {
  ProspectCompanies,
  type ProspectCompaniesCreateParams,
  type ProspectCompaniesCreateResponse,
} from './companies';

export {
  type ProspectCompaniesCreateParams,
  type ProspectCompaniesCreateResponse,
};

export class Prospect extends APIResource {
  companies: CompaniesAPI.ProspectCompanies = new CompaniesAPI.ProspectCompanies(this._client);
}

Prospect.Companies = ProspectCompanies;

export declare namespace Prospect {
  export {
    ProspectCompanies as Companies,
    type ProspectCompaniesCreateResponse as ProspectCompaniesCreateResponse,
    type ProspectCompaniesCreateParams as ProspectCompaniesCreateParams,
  };
}
